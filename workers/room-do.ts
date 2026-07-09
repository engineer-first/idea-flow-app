// 1ルーム = 1 Durable Object の権威サーバー。
// - メンバーシップ（誰がこのルームに入れるか）の真実をここで持つ
// - 付箋の確定状態（notes）の真実をここで持つ
// - 配信は必ず visibleTo（workers/visibility.ts）を通す（選択的送信）
//
// D1 の rooms 行は「招待コード → ルーム解決」のためのディレクトリにすぎない。
// 単一スレッドで直列化されるため、フェーズ遷移や同時編集のレースは構造的に起きない。
import { DurableObject } from "cloudflare:workers";
import {
  NOTE_SPAWN_JITTER,
  NOTE_SPAWN_X_MIN,
  NOTE_SPAWN_Y_MIN,
} from "../contracts/board";
import {
  type ClientMessage,
  DOT_VOTE_LIMITS,
  type DotVoteKind,
  type ProtocolNote,
  parseClientMessage,
  type ServerMessage,
} from "../contracts/room-protocol";
import { migrateRoomStorage } from "./room-do-migrations";
import { filterVisible, visibleTo } from "./visibility";

// api-worker がセッション検証済みのユーザーIDを DO へ引き継ぐヘッダー。
// DO は外部から直接到達できないため、これは常に api-worker が設定する。
export const USER_ID_HEADER = "X-Idea-Flow-User-Id";

type SocketAttachment = {
  userId: string;
};

type NoteRow = {
  id: string;
  author_id: string;
  content: string;
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
};

export class RoomDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // スキーマは room-do-migrations.ts の版管理で管理する。
    // マイグレーション完了までイベント配信を止め、移行中のストレージに
    // 古い・新しいスキーマ前提の操作が届かないようにする。
    this.ctx.blockConcurrencyWhile(async () => {
      migrateRoomStorage(this.ctx.storage);
    });
  }

  // ------------------------------------------------------------
  // RPC（api-worker からのみ呼ばれる）
  // ------------------------------------------------------------

  // 冪等: 既にメンバーでも何も起きない。
  join(userId: string): void {
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO members (user_id) VALUES (?1)",
      userId,
    );
  }

  isMember(userId: string): boolean {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT 1 FROM members WHERE user_id = ?1",
      userId,
    );
    return cursor.toArray().length > 0;
  }

  // ------------------------------------------------------------
  // WebSocket 接続
  // ------------------------------------------------------------

  // 認可（セッション検証・メンバー確認）は api-worker 側で完了しているため、
  // ここではヘッダーを信頼して接続を受け入れる。ヘッダーが無い到達は
  // api-worker を経由していない不正経路なので拒否する（深層防御）。
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const userId = request.headers.get(USER_ID_HEADER);
    if (!userId || !this.isMember(userId)) {
      return new Response("forbidden", { status: 403 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernation API で受け入れ、接続にユーザーIDを添付する。
    // ハイバネーション復帰後も deserializeAttachment で取り出せる。
    this.ctx.acceptWebSocket(server);
    const attachment: SocketAttachment = { userId };
    server.serializeAttachment(attachment);

    this.sendSnapshot(server, userId);

    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    ws: WebSocket,
    raw: ArrayBuffer | string,
  ): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) {
      ws.close(1011, "missing attachment");
      return;
    }

    const message = parseClientMessage(raw);
    if (!message) {
      this.sendTo(ws, {
        type: "error",
        code: "invalid-message",
        message: "メッセージ形式が不正です。",
      });
      return;
    }

    this.handleClientMessage(ws, attachment.userId, message);
  }

  override async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // プレゼンス（在室表示）の導入時に退室通知をここへ実装する。
  }

  override async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    ws.close(1011, "websocket error");
  }

  // ------------------------------------------------------------
  // プロトコル処理
  // ------------------------------------------------------------

  private handleClientMessage(
    ws: WebSocket,
    userId: string,
    message: ClientMessage,
  ): void {
    switch (message.type) {
      case "note:create": {
        const now = new Date().toISOString();
        const note: NoteRow = {
          id: crypto.randomUUID(),
          author_id: userId,
          content: "",
          // 新規付箋はボード中央付近に少しずつずらして配置する。
          x: NOTE_SPAWN_X_MIN + Math.random() * NOTE_SPAWN_JITTER,
          y: NOTE_SPAWN_Y_MIN + Math.random() * NOTE_SPAWN_JITTER,
          created_at: now,
          updated_at: now,
        };
        this.ctx.storage.sql.exec(
          `INSERT INTO notes (id, author_id, content, x, y, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          note.id,
          note.author_id,
          note.content,
          note.x,
          note.y,
          note.created_at,
          note.updated_at,
        );
        this.broadcastNoteInserted(note);
        return;
      }

      case "note:update-content": {
        const row = this.requireNote(ws, message.noteId);
        if (!row) return;
        // 共同編集: メンバーなら誰でも本文を更新できる。
        // authorId はメッセージに存在しないため書き換えは構造的に不可能。
        const updatedAt = new Date().toISOString();
        this.ctx.storage.sql.exec(
          "UPDATE notes SET content = ?2, updated_at = ?3 WHERE id = ?1",
          message.noteId,
          message.content,
          updatedAt,
        );
        this.broadcastNoteUpdated({
          ...row,
          content: message.content,
          updated_at: updatedAt,
        });
        return;
      }

      case "note:move": {
        const row = this.requireNote(ws, message.noteId);
        if (!row) return;
        const updatedAt = new Date().toISOString();
        this.ctx.storage.sql.exec(
          "UPDATE notes SET x = ?2, y = ?3, updated_at = ?4 WHERE id = ?1",
          message.noteId,
          message.x,
          message.y,
          updatedAt,
        );
        this.broadcastNoteUpdated({
          ...row,
          x: message.x,
          y: message.y,
          updated_at: updatedAt,
        });
        return;
      }

      case "note:drag": {
        const row = this.findNote(message.noteId);
        if (!row) {
          // ドラッグは高頻度なためエラー往復はせず黙って捨てる
          // （直後に削除された付箋のドラッグ等、正常系でも起こりうる）。
          return;
        }
        // 永続化しない。送信者自身へはエコーしない（クライアントは自分の
        // ドラッグをローカル反映済みのため、エコーは巻き戻りの原因になる）。
        this.broadcast(
          {
            type: "note:drag",
            noteId: message.noteId,
            x: message.x,
            y: message.y,
          },
          this.toProtocolNote(row, userId),
          ws,
        );
        return;
      }

      case "note:delete": {
        const row = this.requireNote(ws, message.noteId);
        if (!row) return;
        // 削除は author のみ。
        if (row.author_id !== userId) {
          this.sendTo(ws, {
            type: "error",
            code: "forbidden",
            message: "この操作を行う権限がありません。",
          });
          return;
        }
        this.ctx.storage.sql.exec(
          "DELETE FROM notes WHERE id = ?1",
          message.noteId,
        );
        this.broadcast(
          { type: "note:deleted", noteId: message.noteId },
          this.toProtocolNote(row, userId),
        );
        return;
      }

      case "note:vote": {
        const row = this.requireNote(ws, message.noteId);
        if (!row) return;

        const ownCount = this.countUserNoteVotes(
          message.noteId,
          userId,
          message.kind,
        );
        if (message.kind === "subjective" && ownCount > 0) {
          this.ctx.storage.sql.exec(
            `DELETE FROM note_votes
             WHERE note_id = ?1 AND user_id = ?2 AND kind = ?3`,
            message.noteId,
            userId,
            message.kind,
          );
        } else {
          const used = this.countUserVotes(userId, message.kind);
          if (used >= DOT_VOTE_LIMITS[message.kind]) {
            this.sendTo(ws, {
              type: "error",
              code: "forbidden",
              message: "投票上限を超えています。",
            });
            return;
          }
          if (ownCount > 0) {
            this.ctx.storage.sql.exec(
              `UPDATE note_votes
               SET vote_count = vote_count + 1
               WHERE note_id = ?1 AND user_id = ?2 AND kind = ?3`,
              message.noteId,
              userId,
              message.kind,
            );
          } else {
            this.ctx.storage.sql.exec(
              `INSERT INTO note_votes (note_id, user_id, kind, created_at, vote_count)
               VALUES (?1, ?2, ?3, ?4, 1)`,
              message.noteId,
              userId,
              message.kind,
              new Date().toISOString(),
            );
          }
        }

        const updatedAt = new Date().toISOString();
        this.ctx.storage.sql.exec(
          "UPDATE notes SET updated_at = ?2 WHERE id = ?1",
          message.noteId,
          updatedAt,
        );
        this.broadcastNoteUpdated({ ...row, updated_at: updatedAt });
        return;
      }

      case "note:vote-reset": {
        const row = this.requireNote(ws, message.noteId);
        if (!row) return;

        this.ctx.storage.sql.exec(
          `DELETE FROM note_votes
           WHERE note_id = ?1 AND user_id = ?2 AND kind = ?3`,
          message.noteId,
          userId,
          message.kind,
        );

        const updatedAt = new Date().toISOString();
        this.ctx.storage.sql.exec(
          "UPDATE notes SET updated_at = ?2 WHERE id = ?1",
          message.noteId,
          updatedAt,
        );
        this.broadcastNoteUpdated({ ...row, updated_at: updatedAt });
        return;
      }

      default: {
        // メッセージ型の網羅性チェック（コンパイル時のみ意味を持つ）
        const _exhaustive: never = message;
        void _exhaustive;
        return;
      }
    }
  }

  // ------------------------------------------------------------
  // 配信（必ず visibleTo を通す）
  // ------------------------------------------------------------

  private sendSnapshot(ws: WebSocket, userId: string): void {
    const notes = this.listNotes(userId);
    this.sendTo(ws, {
      type: "snapshot",
      notes: filterVisible({ viewerId: userId }, notes),
    });
  }

  private broadcastNoteInserted(row: NoteRow): void {
    this.broadcastNote((viewerId) => ({
      type: "note:inserted",
      note: this.toProtocolNote(row, viewerId),
    }));
  }

  private broadcastNoteUpdated(row: NoteRow): void {
    this.broadcastNote((viewerId) => ({
      type: "note:updated",
      note: this.toProtocolNote(row, viewerId),
    }));
  }

  private broadcastNote(
    buildMessage: (
      viewerId: string,
    ) => Extract<ServerMessage, { type: "note:inserted" | "note:updated" }>,
  ): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment =
        socket.deserializeAttachment() as SocketAttachment | null;
      if (!attachment) continue;
      const message = buildMessage(attachment.userId);
      if (!visibleTo({ viewerId: attachment.userId }, message.note)) continue;
      socket.send(JSON.stringify(message));
    }
  }

  // subject の可視性を受信者ごとに判定して配信する。except は送信者除外用。
  private broadcast(
    message: ServerMessage,
    subject: ProtocolNote,
    except?: WebSocket,
  ): void {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      const attachment =
        socket.deserializeAttachment() as SocketAttachment | null;
      if (!attachment) continue;
      if (!visibleTo({ viewerId: attachment.userId }, subject)) continue;
      socket.send(payload);
    }
  }

  private sendTo(ws: WebSocket, message: ServerMessage): void {
    ws.send(JSON.stringify(message));
  }

  private sendNotFound(ws: WebSocket): void {
    this.sendTo(ws, {
      type: "error",
      code: "not-found",
      message: "付箋が見つかりませんでした。",
    });
  }

  // ------------------------------------------------------------
  // ストレージアクセス
  // ------------------------------------------------------------

  private findNote(noteId: string): NoteRow | null {
    const rows = this.ctx.storage.sql
      .exec("SELECT * FROM notes WHERE id = ?1", noteId)
      .toArray();
    return rows.length > 0 ? (rows[0] as unknown as NoteRow) : null;
  }

  // note:update-content / note:move / note:delete で共通の
  // 「見つからなければ not-found を返して打ち切る」を1箇所にまとめる。
  // note:drag は高頻度なため意図的にこのヘルパーを使わず黙って捨てる。
  private requireNote(ws: WebSocket, noteId: string): NoteRow | null {
    const row = this.findNote(noteId);
    if (!row) {
      this.sendNotFound(ws);
      return null;
    }
    return row;
  }

  private listNotes(viewerId: string): ProtocolNote[] {
    return this.ctx.storage.sql
      .exec("SELECT * FROM notes ORDER BY created_at")
      .toArray()
      .map((row) => this.toProtocolNote(row as unknown as NoteRow, viewerId));
  }

  private hasVote(noteId: string, userId: string, kind: DotVoteKind): boolean {
    return this.countUserNoteVotes(noteId, userId, kind) > 0;
  }

  private countUserNoteVotes(
    noteId: string,
    userId: string,
    kind: DotVoteKind,
  ): number {
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT COALESCE(SUM(vote_count), 0) AS count FROM note_votes
         WHERE note_id = ?1 AND user_id = ?2 AND kind = ?3`,
        noteId,
        userId,
        kind,
      )
      .toArray();
    return Number(rows[0]?.count ?? 0);
  }

  private countUserVotes(userId: string, kind: DotVoteKind): number {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT COALESCE(SUM(vote_count), 0) AS count FROM note_votes WHERE user_id = ?1 AND kind = ?2",
        userId,
        kind,
      )
      .toArray();
    return Number(rows[0]?.count ?? 0);
  }

  private countNoteVotes(noteId: string, kind: DotVoteKind): number {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT COALESCE(SUM(vote_count), 0) AS count FROM note_votes WHERE note_id = ?1 AND kind = ?2",
        noteId,
        kind,
      )
      .toArray();
    return Number(rows[0]?.count ?? 0);
  }

  private toProtocolNote(row: NoteRow, viewerId: string): ProtocolNote {
    return {
      id: row.id,
      authorId: row.author_id,
      content: row.content,
      x: row.x,
      y: row.y,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      dotVotes: {
        subjective: {
          count: this.countNoteVotes(row.id, "subjective"),
          votedByMe: this.hasVote(row.id, viewerId, "subjective"),
          ownCount: this.countUserNoteVotes(row.id, viewerId, "subjective"),
        },
        objective: {
          count: this.countNoteVotes(row.id, "objective"),
          votedByMe: this.hasVote(row.id, viewerId, "objective"),
          ownCount: this.countUserNoteVotes(row.id, viewerId, "objective"),
        },
      },
    };
  }
}

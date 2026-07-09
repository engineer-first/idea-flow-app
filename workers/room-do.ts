// 1ルーム = 1 Durable Object の権威サーバー。
// - メンバーシップ（誰がこのルームに入れるか）の真実をここで持つ
// - 付箋の確定状態（notes）の真実をここで持つ
// - 進行状態 (lobby / writing) の真実をここで持つ
// - 配信は必ず visibleTo（workers/visibility.ts）を通す（選択的送信）
//   メンバー参加・進行状態のように参加者全員が受け取る情報は
//   broadcastToAll という別経路で送る（visibleTo はノートにだけ適用する）
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
  type Phase,
  type ProtocolMember,
  type ProtocolNote,
  parseClientMessage,
  type ServerMessage,
  WS_CLOSE_LEFT_ROOM,
  WS_CLOSE_LEFT_ROOM_REASON,
  WS_CLOSE_ROOM_DISBANDED,
  WS_CLOSE_ROOM_DISBANDED_REASON,
} from "../contracts/room-protocol";
import { migrateRoomStorage } from "./room-do-migrations";
import { filterVisible, visibleTo } from "./visibility";

// api-worker がセッション検証済みのユーザーIDを DO へ引き継ぐヘッダー。
// DO は外部から直接到達できないため、これは常に api-worker が設定する。
export const USER_ID_HEADER = "X-Idea-Flow-User-Id";

// ルーム作成者のユーザーID。start_phase の認可（ホスト判定）で使う。
// api-worker が D1 rooms.host_id を解決してセットする。
export const HOST_ID_HEADER = "X-Idea-Flow-Host-Id";

type SocketAttachment = {
  userId: string;
  hostId: string;
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

type MemberRow = {
  user_id: string;
  name: string;
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

  // 参加処理。name は表示用（#70 のメンバー一覧で使う）。
  // 冪等: 既存メンバーなら name だけを最新に同期して終わる。
  // 進行中のルームでも新規メンバーの参加は可能（#70 メモ: 途中参加OK）。
  //
  // 新規メンバーの場合のみ、既存メンバー全員の WS に member_joined を
  // broadcast する（#70 の Realtime 反映）。新規メンバー本人には
  // snapshot.members が届くので送らない（本人除外）。
  async upsertMember(userId: string, name: string | undefined): Promise<void> {
    const safeName = name ?? "";
    const existed = this.isMember(userId);
    this.ctx.storage.sql.exec(
      `INSERT INTO members (user_id, name) VALUES (?1, ?2)
       ON CONFLICT (user_id) DO UPDATE SET name = ?2`,
      userId,
      safeName,
    );
    if (!existed) {
      this.broadcastToAllExcept(
        { type: "member_joined", member: { userId, name: safeName } },
        userId,
      );
    }
  }

  // 旧シグネチャ。api-worker の後方互換のために残し、内部で upsertMember に
  // 委譲する。新規呼び出しは upsertMember を使う。
  join(userId: string): Promise<void> {
    return this.upsertMember(userId, undefined);
  }

  isMember(userId: string): boolean {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT 1 FROM members WHERE user_id = ?1",
      userId,
    );
    return cursor.toArray().length > 0;
  }

  // 退出処理（#70 退室機能）。
  async leave(userId: string): Promise<void> {
    if (!this.isMember(userId)) {
      return;
    }
    for (const socket of this.ctx.getWebSockets()) {
      const attachment =
        socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.userId === userId) {
        try {
          socket.close(WS_CLOSE_LEFT_ROOM, WS_CLOSE_LEFT_ROOM_REASON);
        } catch {
          // 既に閉じている等のエラーは握りつぶす
        }
      }
    }
    this.ctx.storage.sql.exec("DELETE FROM members WHERE user_id = ?1", userId);
    this.broadcastToAllExcept({ type: "member_left", userId }, userId);
  }

  // ルーム解散（ホスト操作）。全 WS を閉じ、members / notes を空にする。
  async disband(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(WS_CLOSE_ROOM_DISBANDED, WS_CLOSE_ROOM_DISBANDED_REASON);
      } catch {
        // 既に閉じている等のエラーは握りつぶす
      }
    }
    this.ctx.storage.sql.exec("DELETE FROM notes");
    this.ctx.storage.sql.exec("DELETE FROM note_votes");
    this.ctx.storage.sql.exec("DELETE FROM members");
    this.ctx.storage.sql.exec(
      `UPDATE room_state SET phase = 'lobby', changed_at = ?1 WHERE id = 1`,
      new Date().toISOString(),
    );
  }

  // メンバー一覧を参加順（joined_at 昇順）で返す。snapshot 構築に使う。
  listMembers(): { userId: string; name: string }[] {
    const rows = this.ctx.storage.sql
      .exec("SELECT user_id, name FROM members ORDER BY joined_at")
      .toArray();
    return rows.map((row) => {
      const member = row as unknown as MemberRow;
      return { userId: member.user_id, name: member.name };
    });
  }

  getPhase(): Phase {
    const rows = this.ctx.storage.sql
      .exec("SELECT phase FROM room_state WHERE id = 1")
      .toArray();
    const row = rows[0] as { phase: string } | undefined;
    const phase = row?.phase ?? "lobby";
    return phase === "writing" ? "writing" : "lobby";
  }

  async setPhase(
    phase: Phase,
    byUserId: string,
    expectedHostId: string,
  ): Promise<void> {
    if (byUserId !== expectedHostId) {
      throw new Error("進行状態を変更する権限がありません。");
    }
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `UPDATE room_state SET phase = ?1, changed_at = ?2 WHERE id = 1`,
      phase,
      now,
    );
  }

  // ------------------------------------------------------------
  // WebSocket 接続
  // ------------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const userId = request.headers.get(USER_ID_HEADER);
    if (!userId || !this.isMember(userId)) {
      return new Response("forbidden", { status: 403 });
    }

    const hostId = request.headers.get(HOST_ID_HEADER);
    if (!hostId) {
      return new Response("forbidden", { status: 403 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const attachment: SocketAttachment = { userId, hostId };
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

    this.handleClientMessage(ws, attachment, message);
  }

  override async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // 退室の正式経路は leave RPC。切断時の自動 member_left はプレゼンス導入時に検討。
  }

  override async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    ws.close(1011, "websocket error");
  }

  // ------------------------------------------------------------
  // プロトコル処理
  // ------------------------------------------------------------

  private handleClientMessage(
    ws: WebSocket,
    attachment: SocketAttachment,
    message: ClientMessage,
  ): void {
    const { userId, hostId } = attachment;
    switch (message.type) {
      case "note:create": {
        const now = new Date().toISOString();
        const note: NoteRow = {
          id: crypto.randomUUID(),
          author_id: userId,
          content: "",
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
          return;
        }
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
        this.ctx.storage.sql.exec(
          "DELETE FROM note_votes WHERE note_id = ?1",
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

      case "start_phase": {
        if (userId !== hostId) {
          this.sendTo(ws, {
            type: "error",
            code: "forbidden",
            message: "進行状態を変更する権限がありません。",
          });
          return;
        }
        this.setPhase("writing", userId, hostId);
        this.broadcastToAll({ type: "phase_changed", phase: "writing" });
        return;
      }

      default: {
        const _exhaustive: never = message;
        void _exhaustive;
        return;
      }
    }
  }

  // ------------------------------------------------------------
  // 配信（ノートは visibleTo、メンバー/phase は全員）
  // ------------------------------------------------------------

  private sendSnapshot(ws: WebSocket, userId: string): void {
    const notes = this.listNotes(userId);
    this.sendTo(ws, {
      type: "snapshot",
      notes: filterVisible({ viewerId: userId }, notes),
      members: this.listMembers().map((m) => this.toProtocolMember(m)),
      phase: this.getPhase(),
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

  // ノート以外の共有情報（member / phase）を全員に送る。
  private broadcastToAll(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }

  private broadcastToAllExcept(
    message: ServerMessage,
    exceptUserId: string,
  ): void {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment =
        socket.deserializeAttachment() as SocketAttachment | null;
      if (!attachment || attachment.userId === exceptUserId) continue;
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

  private toProtocolMember(member: {
    userId: string;
    name: string;
  }): ProtocolMember {
    return { userId: member.userId, name: member.name };
  }
}

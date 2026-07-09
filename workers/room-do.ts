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
  // upsertMember が async になったので、Promise を返して呼び出し側を
  // await できる形にする（テストや呼び出し箇所の単純化のため）。
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
  // - 同じ userId で複数の WS が開いている場合（複数タブ）すべて close する
  // - members テーブルから該当行を削除する
  // - 他メンバー全員に member_left を broadcast する（退室者本人には送らない）
  // 冪等: メンバーでない userId で呼んでも no-op。再参加は同じ招待URLから可能。
  // 1 度 close した WS は getWebSockets() からも除去されるが、タイミング
  // によっては残っていることもあるので broadcastToAllExcept は userId で
  // 除外する。
  async leave(userId: string): Promise<void> {
    if (!this.isMember(userId)) {
      // 既に退出済み（または元々非メンバー）なら何もしない。
      return;
    }
    // 1. 該当 userId の WS をすべて close
    for (const socket of this.ctx.getWebSockets()) {
      const attachment =
        socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.userId === userId) {
        // 4000 = アプリ定義の「退出による close」。クライアントは再接続しない。
        try {
          socket.close(WS_CLOSE_LEFT_ROOM, WS_CLOSE_LEFT_ROOM_REASON);
        } catch {
          // 既に閉じている等のエラーは握りつぶす
        }
      }
    }
    // 2. members から削除
    this.ctx.storage.sql.exec("DELETE FROM members WHERE user_id = ?1", userId);
    // 3. 他メンバー全員に member_left を broadcast（本人除外）
    this.broadcastToAllExcept({ type: "member_left", userId }, userId);
  }

  // ルーム解散（ホスト操作）。全 WS を閉じ、members / notes を空にする。
  // D1 rooms 行の削除は api-worker 側の責務。
  // close code 4001 で「解散」と個人退出 (4000) を区別し、クライアントが理由を表示する。
  async disband(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(WS_CLOSE_ROOM_DISBANDED, WS_CLOSE_ROOM_DISBANDED_REASON);
      } catch {
        // 既に閉じている等のエラーは握りつぶす
      }
    }
    this.ctx.storage.sql.exec("DELETE FROM notes");
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

  // 現在の進行状態を返す。レコードが無ければ lobby とする。
  getPhase(): Phase {
    const rows = this.ctx.storage.sql
      .exec("SELECT phase FROM room_state WHERE id = 1")
      .toArray();
    const row = rows[0] as { phase: string } | undefined;
    const phase = row?.phase ?? "lobby";
    return phase === "writing" ? "writing" : "lobby";
  }

  // 進行状態を更新する。ホスト以外が呼ぶと reject（二重防御）。
  // api-worker 側でも session.sub === rooms.host_id を判定しているが、
  // RoomDO 単体で呼んだ場合の最後の砦として再判定する。
  // Durable Object の RPC 境界は async/Promise を期待するため、
  // throw ではなく reject で返す（unhandled rejection 回避）。
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

    const hostId = request.headers.get(HOST_ID_HEADER);
    if (!hostId) {
      // HOST_ID_HEADER は api-worker が必ずセットする。未設定は不正経路。
      return new Response("forbidden", { status: 403 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernation API で受け入れ、接続にユーザーIDと hostId を添付する。
    // ハイバネーション復帰後も deserializeAttachment で取り出せる。
    this.ctx.acceptWebSocket(server);
    const attachment: SocketAttachment = { userId, hostId };
    server.serializeAttachment(attachment);

    this.sendSnapshot(server);

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
    // 退室通知は #70 のスコープ外（Issue メモ: 退室機能は対象外）。
    // プレゼンス（在室表示）の導入時にここに member_left を実装する。
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
        const note: ProtocolNote = {
          id: crypto.randomUUID(),
          authorId: userId,
          content: "",
          // 新規付箋はボード中央付近に少しずつずらして配置する。
          x: NOTE_SPAWN_X_MIN + Math.random() * NOTE_SPAWN_JITTER,
          y: NOTE_SPAWN_Y_MIN + Math.random() * NOTE_SPAWN_JITTER,
          createdAt: now,
          updatedAt: now,
        };
        this.ctx.storage.sql.exec(
          `INSERT INTO notes (id, author_id, content, x, y, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          note.id,
          note.authorId,
          note.content,
          note.x,
          note.y,
          note.createdAt,
          note.updatedAt,
        );
        this.broadcastNote({ type: "note:inserted", note }, note);
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
        const note = this.toProtocolNote({
          ...row,
          content: message.content,
          updated_at: updatedAt,
        });
        this.broadcastNote({ type: "note:updated", note }, note);
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
        const note = this.toProtocolNote({
          ...row,
          x: message.x,
          y: message.y,
          updated_at: updatedAt,
        });
        this.broadcastNote({ type: "note:updated", note }, note);
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
        this.broadcastNote(
          {
            type: "note:drag",
            noteId: message.noteId,
            x: message.x,
            y: message.y,
          },
          this.toProtocolNote(row),
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
        this.broadcastNote(
          { type: "note:deleted", noteId: message.noteId },
          this.toProtocolNote(row),
        );
        return;
      }

      case "start_phase": {
        // 進行状態の変更はホストだけが行える。attachment.hostId は api-worker
        // が D1 rooms.host_id から詰めた信頼値、userId は api-worker が
        // セッションから詰めた信頼値。両方を再照合する（二重防御）。
        if (userId !== hostId) {
          this.sendTo(ws, {
            type: "error",
            code: "forbidden",
            message: "進行状態を変更する権限がありません。",
          });
          return;
        }
        // 現時点では lobby → writing の1方向のみ。逆方向や別フェーズは
        // #71 のスコープで拡張する。
        this.setPhase("writing", userId, hostId);
        this.broadcastToAll({ type: "phase_changed", phase: "writing" });
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
  // 配信（ノートは visibleTo を通す / メンバー・進行状態は全員に送る）
  // ------------------------------------------------------------

  private sendSnapshot(ws: WebSocket): void {
    const notes = this.listNotes();
    // snapshot の notes は「接続してきた本人に対する可視性」だけで絞る。
    // 現状は全員に同じだが、将来の分岐のため viewer を受け取れる形にする。
    const viewerId = this.viewerIdOf(ws);
    this.sendTo(ws, {
      type: "snapshot",
      notes: filterVisible({ viewerId }, notes),
      members: this.listMembers().map((m) => this.toProtocolMember(m)),
      phase: this.getPhase(),
    });
  }

  // ノートを含むメッセージの配信。送信者ごとに visibleTo を見て、
  // 見えない接続には送らない。
  private broadcastNote(
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

  // メンバー参加・進行状態など「参加者全員が受け取る」メッセージの配信。
  // visibleTo は使わない（ノートの可視性とは独立した概念のため）。
  private broadcastToAll(message: ServerMessage, except?: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      socket.send(payload);
    }
  }

  // 「参加者全員が受け取る」が、特定 userId の WS だけ除外するパターン。
  // member_joined で新規メンバー本人を宛先から除くために使う。
  // RPC 経由（upsertMember など）で「送信者の WS」が存在しない経路でも
  // 安全（userId 単位の除外なので、attachment の userId を見ている）。
  private broadcastToAllExcept(
    message: ServerMessage,
    exceptUserId: string,
  ): void {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment =
        socket.deserializeAttachment() as SocketAttachment | null;
      if (!attachment) continue;
      if (attachment.userId === exceptUserId) continue;
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

  private viewerIdOf(ws: WebSocket): string {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    return attachment?.userId ?? "";
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

  private listNotes(): ProtocolNote[] {
    return this.ctx.storage.sql
      .exec("SELECT * FROM notes ORDER BY created_at")
      .toArray()
      .map((row) => this.toProtocolNote(row as unknown as NoteRow));
  }

  private toProtocolNote(row: NoteRow): ProtocolNote {
    return {
      id: row.id,
      authorId: row.author_id,
      content: row.content,
      x: row.x,
      y: row.y,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toProtocolMember(row: {
    userId: string;
    name: string;
  }): ProtocolMember {
    return {
      userId: row.userId,
      name: row.name,
    };
  }
}

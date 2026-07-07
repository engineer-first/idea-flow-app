// 1ルーム = 1 Durable Object の権威サーバー。
// メンバーシップ（誰がこのルームに入れるか）の真実をここで持つ。
// D1 の rooms 行は「招待コード → ルーム解決」のためのディレクトリにすぎない。
//
// Phase 1: メンバー管理と WebSocket 接続の受け入れまで。
// Phase 2 で付箋の状態・選択的送信 (visibleTo)・プレゼンスを実装する。
import { DurableObject } from "cloudflare:workers";

// api-worker がセッション検証済みのユーザーIDを DO へ引き継ぐためのヘッダー。
// DO は外部から直接到達できないため、このヘッダーは常に api-worker が設定する。
export const USER_ID_HEADER = "X-Idea-Flow-User-Id";

export class RoomDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS members (
           user_id TEXT PRIMARY KEY,
           joined_at TEXT NOT NULL DEFAULT (datetime('now'))
         )`,
      );
    });
  }

  // 冪等: 既にメンバーでも何も起きない（Supabase 時代の join_room と同じ契約）。
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

  getMemberIds(): string[] {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT user_id FROM members ORDER BY joined_at",
    );
    return cursor.toArray().map((row) => String(row.user_id));
  }

  // WebSocket 接続。認可（セッション検証・メンバー確認）は api-worker 側で
  // 完了しているため、ここでは USER_ID_HEADER を信頼して接続を受け入れる。
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const userId = request.headers.get(USER_ID_HEADER);
    if (!userId || !this.isMember(userId)) {
      // api-worker を経由しない不正な到達は拒否する（深層防御）。
      return new Response("forbidden", { status: 403 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernation API で受け入れ、接続にユーザーIDを添付する。
    // ハイバネーション復帰後も deserializeAttachment で取り出せる。
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId });
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    _ws: WebSocket,
    _message: ArrayBuffer | string,
  ): Promise<void> {
    // Phase 2: contracts/room-protocol.ts のメッセージを処理する。
  }

  override async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Phase 2: プレゼンス（退室通知）を実装する。
  }

  override async webSocketError(
    _ws: WebSocket,
    _error: unknown,
  ): Promise<void> {
    // Phase 2: エラー時の切断処理を実装する。
  }
}

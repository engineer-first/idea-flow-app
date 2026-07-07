// 1ルーム = 1 Durable Object の権威サーバー。
// Phase 0 時点では WebSocket の受け入れとエコーのみ（ゲート検証用の骨格）。
// Phase 2 で状態機械・notes CRUD・選択的送信(visibleTo)をここへ実装する。
import { DurableObject } from "cloudflare:workers";

export class RoomDO extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      // Hibernation API で受け入れる。イベントハンドラ完了後は
      // メモリから退避可能になり、アイドル時間の課金が発生しない。
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("expected websocket", { status: 426 });
  }

  override async webSocketMessage(
    ws: WebSocket,
    message: ArrayBuffer | string,
  ): Promise<void> {
    ws.send(`echo:${message}`);
  }

  override async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Phase 2 でプレゼンス管理（退室通知）をここに実装する。
  }

  override async webSocketError(
    _ws: WebSocket,
    _error: unknown,
  ): Promise<void> {
    // Phase 2 でエラー時の切断処理をここに実装する。
  }
}

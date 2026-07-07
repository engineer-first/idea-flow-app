// ルーム WebSocket クライアント。フレームワーク非依存の純粋なロジックで、
// React からは room-board.tsx（コンテナ）が useEffect で生成・破棄する。
//
// 再接続の考え方: 予期しない切断では指数バックオフで再接続する。
// 再接続後はサーバー（RoomDO）が snapshot を送ってくるため、クライアント側で
// 差分の取りこぼしを追跡する必要がない（復帰パスをサーバーの契約にしている）。
import {
  type ClientMessage,
  parseServerMessage,
  type ServerMessage,
} from "@/contracts/room-protocol";

const WEBSOCKET_OPEN = 1;

// 1s → 2s → 4s → 8s、以降は 8s ごと。
const DEFAULT_RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000];

export type RoomSocketFactory = (url: string) => WebSocket;

// UI が「接続中 / 接続済み / 切断（再接続待ち）」を表示するための状態。
// closed は「予期しない切断」のみで、close() による意図的な終了では通知しない
// （終了時は呼び出し側がアンマウント中で、表示する画面がもう無いため）。
export type RoomConnectionStatus = "connecting" | "open" | "closed";

export type RoomClientOptions = {
  url: string;
  onMessage: (message: ServerMessage) => void;
  onStatusChange?: (status: RoomConnectionStatus) => void;
  // テストや Storybook からフェイクを注入するための口。
  webSocketFactory?: RoomSocketFactory;
  reconnectDelaysMs?: number[];
};

export type RoomClient = {
  send(message: ClientMessage): void;
  close(): void;
};

export function createRoomClient(options: RoomClientOptions): RoomClient {
  const factory: RoomSocketFactory =
    options.webSocketFactory ?? ((url) => new WebSocket(url));
  const delays = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS;

  let socket: WebSocket | null = null;
  let closedByUser = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    const ws = factory(options.url);
    socket = ws;
    options.onStatusChange?.("connecting");

    ws.addEventListener("open", () => {
      reconnectAttempt = 0;
      options.onStatusChange?.("open");
    });

    ws.addEventListener("message", (event) => {
      const message = parseServerMessage(event.data);
      if (!message) {
        console.warn(
          "解釈できないサーバーメッセージを無視しました:",
          event.data,
        );
        return;
      }
      options.onMessage(message);
    });

    ws.addEventListener("close", () => {
      if (closedByUser || socket !== ws) {
        return;
      }
      options.onStatusChange?.("closed");
      scheduleReconnect();
    });
  }

  function scheduleReconnect(): void {
    const delay = delays[Math.min(reconnectAttempt, delays.length - 1)] ?? 1000;
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  connect();

  return {
    send(message: ClientMessage): void {
      if (!socket || socket.readyState !== WEBSOCKET_OPEN) {
        console.warn("接続確立前のメッセージ送信を破棄しました:", message.type);
        return;
      }
      socket.send(JSON.stringify(message));
    },
    close(): void {
      closedByUser = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
    },
  };
}

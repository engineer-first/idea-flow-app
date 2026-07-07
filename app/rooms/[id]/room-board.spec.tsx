// RoomBoard（コンテナ）の統合テスト。
// フェイク WebSocket を注入し、「サーバーメッセージ → 画面反映」と
// 「ユーザー操作 → プロトコルメッセージ送信」の両方向の配線を検証する。
// BoardView / NoteCard / notes-reducer 自体の仕様は各ファイルの spec が担う。
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomBoard } from "@/app/rooms/[id]/room-board";
import type { ProtocolNote } from "@/contracts/room-protocol";

const ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Listener = (event: { data?: unknown }) => void;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Listener[]>();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  simulateOpen(): void {
    this.readyState = 1;
    this.emit("open", {});
  }

  simulateServerMessage(message: unknown): void {
    this.emit("message", { data: JSON.stringify(message) });
  }

  private emit(type: string, event: { data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function protocolNote(overrides?: Partial<ProtocolNote>): ProtocolNote {
  return {
    id: NOTE_ID,
    roomId: ROOM_ID,
    authorId: USER_ID,
    content: "最初の付箋",
    x: 100,
    y: 100,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}

function renderBoard() {
  FakeWebSocket.instances = [];
  const factory = (url: string) =>
    new FakeWebSocket(url) as unknown as WebSocket;
  const view = render(
    <RoomBoard
      roomId={ROOM_ID}
      inviteCode="AB12CD"
      inviteUrl="https://idea-flow.example/invite/AB12CD"
      initialNotes={[]}
      webSocketFactory={factory}
    />,
  );
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("WebSocket が生成されていない");
  act(() => socket.simulateOpen());
  return { view, socket };
}

function connectWithSnapshot(notes: ProtocolNote[] = []) {
  const { view, socket } = renderBoard();
  act(() =>
    socket.simulateServerMessage({
      type: "snapshot",
      room: { roomId: ROOM_ID, inviteCode: "AB12CD" },
      self: { userId: USER_ID },
      notes,
    }),
  );
  return { view, socket };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("サーバーメッセージ → 画面反映", () => {
  it("snapshot の付箋がボードに描画される", () => {
    connectWithSnapshot([protocolNote()]);
    expect(screen.getByDisplayValue("最初の付箋")).toBeInTheDocument();
  });

  it("note:inserted で付箋が追加される", () => {
    const { socket } = connectWithSnapshot([]);
    act(() =>
      socket.simulateServerMessage({
        type: "note:inserted",
        note: protocolNote({ content: "あとから届いた付箋" }),
      }),
    );
    expect(screen.getByDisplayValue("あとから届いた付箋")).toBeInTheDocument();
  });

  it("note:updated で本文が置き換わる", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);
    act(() =>
      socket.simulateServerMessage({
        type: "note:updated",
        note: protocolNote({ content: "更新後の本文" }),
      }),
    );
    expect(screen.getByDisplayValue("更新後の本文")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("最初の付箋")).not.toBeInTheDocument();
  });

  it("note:deleted で付箋が消える", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);
    act(() =>
      socket.simulateServerMessage({ type: "note:deleted", noteId: NOTE_ID }),
    );
    expect(screen.queryByDisplayValue("最初の付箋")).not.toBeInTheDocument();
  });

  it("error メッセージはクラッシュせずログに残る", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { socket } = connectWithSnapshot([]);
    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "forbidden",
        message: "この操作を行う権限がありません。",
      }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("forbidden"),
    );
  });
});

describe("ユーザー操作 → プロトコルメッセージ送信", () => {
  it("「付箋を追加」で note:create が送信される（楽観挿入はしない）", () => {
    const { socket } = connectWithSnapshot([]);

    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    expect(socket.sent).toContain(JSON.stringify({ type: "note:create" }));
    // 確定（note:inserted）が届くまでは描画されない。
    expect(screen.queryAllByTestId("note-card")).toHaveLength(0);
  });

  it("アンマウントで WebSocket を閉じる", () => {
    const { view, socket } = connectWithSnapshot([]);
    view.unmount();
    expect(socket.readyState).toBe(3);
  });
});

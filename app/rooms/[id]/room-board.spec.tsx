// RoomBoard（コンテナ）の統合テスト。
// フェイク WebSocket を注入し、「サーバーメッセージ → 画面反映」と
// 「ユーザー操作 → プロトコルメッセージ送信」の両方向の配線を検証する。
// BoardView / NoteCard / notes-reducer 自体の仕様は各ファイルの spec が担う。
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// useRouter の戻り値は毎レンダー同じ参照にする（effect の再実行ループ防止）。
const navigationMocks = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => navigationMocks.router,
}));

const notifyMocks = vi.hoisted(() => ({
  memberJoined: vi.fn(),
  memberLeft: vi.fn(),
  roomDisbanded: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/app/_lib/notify", () => ({
  notify: {
    memberJoined: notifyMocks.memberJoined,
    memberLeft: notifyMocks.memberLeft,
    roomDisbanded: notifyMocks.roomDisbanded,
    roomCreated: vi.fn(),
    joinedAsHost: vi.fn(),
    joinedAsGuest: vi.fn(),
    error: notifyMocks.error,
  },
}));

import { FORCE_NEXT_PHASE_COPY } from "@/app/rooms/[id]/force-next-phase-dialog";
import { RoomBoard } from "@/app/rooms/[id]/room-board";
import type { ProtocolNote } from "@/contracts/room-protocol";

const ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const NOTE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Listener = (event: {
  data?: unknown;
  code?: number;
  reason?: string;
}) => void;

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

  simulateUnexpectedClose(): void {
    this.readyState = 3;
    this.emit("close", {});
  }

  simulateLeftRoomClose(): void {
    this.readyState = 3;
    this.emit("close", { code: 4000, reason: "left the room" });
  }

  simulateDisbandedClose(): void {
    this.readyState = 3;
    this.emit("close", { code: 4001, reason: "room disbanded" });
  }

  simulateServerMessage(message: unknown): void {
    this.emit("message", { data: JSON.stringify(message) });
  }

  private emit(
    type: string,
    event: { data?: unknown; code?: number; reason?: string },
  ): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function protocolNote(overrides?: Partial<ProtocolNote>): ProtocolNote {
  return {
    id: NOTE_ID,
    authorId: USER_ID,
    content: "最初の付箋",
    visibility: "shared",
    color: "yellow",
    x: 100,
    y: 100,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    dotVotes: {
      subjective: { count: 0, votedByMe: false, ownCount: 0 },
      objective: { count: 0, votedByMe: false, ownCount: 0 },
    },
    ...overrides,
  };
}

function renderBoard(options: { open?: boolean; isHost?: boolean } = {}) {
  FakeWebSocket.instances = [];
  const factory = (url: string) =>
    new FakeWebSocket(url) as unknown as WebSocket;
  const view = render(
    <RoomBoard
      roomId={ROOM_ID}
      inviteCode="AB12CD"
      inviteUrl="https://idea-flow.example/invite/AB12CD"
      currentUserId={USER_ID}
      isHost={options.isHost ?? true}
      hostUserId={USER_ID}
      initialMembers={[]}
      initialPhase="phase1"
      webSocketFactory={factory}
    />,
  );
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("WebSocket が生成されていない");
  if (options.open !== false) {
    act(() => socket.simulateOpen());
  }
  return { view, socket };
}

function connectWithSnapshot(
  notes: ProtocolNote[] = [],
  options?: {
    phase?: "phase1" | "phase2" | "phase3";
    isHost?: boolean;
  },
) {
  const { view, socket } = renderBoard({ isHost: options?.isHost ?? true });

  act(() =>
    socket.simulateServerMessage({
      type: "snapshot",
      notes,
      members: [],
      phase: options?.phase ?? "phase1",
      isHost: options?.isHost ?? true,
      timer: { status: "idle" },
      serverNow: Date.now(),
    }),
  );

  return { view, socket };
}

afterEach(() => {
  vi.restoreAllMocks();
  navigationMocks.replace.mockReset();
  notifyMocks.memberJoined.mockReset();
  notifyMocks.memberLeft.mockReset();
  notifyMocks.roomDisbanded.mockReset();
  notifyMocks.error.mockReset();
});

describe("メンバー参加・退出の通知", () => {
  it("member_joined を受信すると notify.memberJoined を呼ぶ", () => {
    const { socket } = connectWithSnapshot([]);
    act(() =>
      socket.simulateServerMessage({
        type: "member_joined",
        member: { userId: OTHER_USER_ID, name: "Taro", color: "yellow" },
      }),
    );
    expect(notifyMocks.memberJoined).toHaveBeenCalledTimes(1);
    expect(notifyMocks.memberJoined).toHaveBeenCalledWith("Taro");
  });

  it("member_left を受信すると members から名前を引き、notify.memberLeft を呼ぶ", () => {
    const { socket } = renderBoard();
    act(() =>
      socket.simulateServerMessage({
        type: "snapshot",
        notes: [],
        members: [
          { userId: USER_ID, name: "Host", color: "yellow" },
          { userId: OTHER_USER_ID, name: "Taro", color: "green" },
        ],
        phase: "phase1",
        isHost: true,
        timer: { status: "idle" },
        serverNow: Date.now(),
      }),
    );
    act(() =>
      socket.simulateServerMessage({
        type: "member_left",
        userId: OTHER_USER_ID,
      }),
    );
    expect(notifyMocks.memberLeft).toHaveBeenCalledTimes(1);
    expect(notifyMocks.memberLeft).toHaveBeenCalledWith("Taro");
  });
});

describe("サーバーメッセージ → 画面反映", () => {
  it("snapshot のタイマーを表示し、ホスト操作を timer:* として送る", () => {
    const { socket } = connectWithSnapshot([]);

    fireEvent.click(screen.getByRole("button", { name: "開始" }));
    expect(socket.sent).toContain(
      JSON.stringify({ type: "timer:start", durationMs: 180_000 }),
    );

    act(() =>
      socket.simulateServerMessage({
        type: "timer:updated",
        timer: { status: "paused", remainingMs: 30_000, durationMs: 180_000 },
        serverNow: Date.now(),
      }),
    );
    expect(screen.getByRole("timer")).toHaveTextContent("00:30");
    fireEvent.click(screen.getByRole("button", { name: "再開" }));
    expect(socket.sent).toContain(JSON.stringify({ type: "timer:resume" }));
  });

  it("forbidden エラーを受信するとポップアップ通知を表示する", () => {
    const { socket } = connectWithSnapshot([], { phase: "phase3" });

    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "forbidden",
        message: "ホストのみ操作できます。",
      }),
    );

    expect(notifyMocks.error).toHaveBeenCalledWith("ホストのみ操作できます。");
  });

  it("投票未完了（voting-incomplete）を受信すると toast ではなく強制進行の確認を表示し、確認で force 付き phase:next を送信する", () => {
    const { socket } = connectWithSnapshot([], {
      isHost: true,
      phase: "phase3",
    });

    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "voting-incomplete",
        message: "全員の主観・客観投票が完了していません。",
      }),
    );

    expect(notifyMocks.error).not.toHaveBeenCalled();
    expect(screen.getByText(FORCE_NEXT_PHASE_COPY.title)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: FORCE_NEXT_PHASE_COPY.confirm }),
    );

    expect(socket.sent).toContain(
      JSON.stringify({ type: "phase:next", force: true }),
    );
  });

  it("非ホストに voting-incomplete が届いた場合はダイアログを開かず toast へフォールバックする", () => {
    // サーバーの評価順では非ホストに届かないコードだが、UI 側はその暗黙の
    // 保証に依存せず通常のエラー表示へ落とすことを固定する。
    const { socket } = connectWithSnapshot([], {
      isHost: false,
      phase: "phase3",
    });

    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "voting-incomplete",
        message: "全員の主観・客観投票が完了していません。",
      }),
    );

    expect(notifyMocks.error).toHaveBeenCalledWith(
      "全員の主観・客観投票が完了していません。",
    );
    expect(
      screen.queryByText(FORCE_NEXT_PHASE_COPY.title),
    ).not.toBeInTheDocument();
  });

  it("強制進行の確認ダイアログは phase:updated の受信で閉じる", () => {
    // 別タブなど他の経路で進行が確定したら、開いていた確認は根拠が古い。
    const { socket } = connectWithSnapshot([], {
      isHost: true,
      phase: "phase3",
    });

    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "voting-incomplete",
        message: "全員の主観・客観投票が完了していません。",
      }),
    );
    expect(screen.getByText(FORCE_NEXT_PHASE_COPY.title)).toBeInTheDocument();

    act(() =>
      socket.simulateServerMessage({ type: "phase:updated", phase: "phase4" }),
    );

    expect(
      screen.queryByText(FORCE_NEXT_PHASE_COPY.title),
    ).not.toBeInTheDocument();
  });

  it("強制進行の確認ダイアログは再接続の snapshot 受信で閉じる", () => {
    const { socket } = connectWithSnapshot([], {
      isHost: true,
      phase: "phase3",
    });

    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "voting-incomplete",
        message: "全員の主観・客観投票が完了していません。",
      }),
    );
    expect(screen.getByText(FORCE_NEXT_PHASE_COPY.title)).toBeInTheDocument();

    act(() =>
      socket.simulateServerMessage({
        type: "snapshot",
        notes: [],
        members: [],
        phase: "phase4",
        isHost: true,
      }),
    );

    expect(
      screen.queryByText(FORCE_NEXT_PHASE_COPY.title),
    ).not.toBeInTheDocument();
  });

  it("強制進行の確認をキャンセルすると force 付き phase:next は送信されない", () => {
    const { socket } = connectWithSnapshot([], {
      isHost: true,
      phase: "phase3",
    });

    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "voting-incomplete",
        message: "全員の主観・客観投票が完了していません。",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: FORCE_NEXT_PHASE_COPY.cancel }),
    );

    expect(socket.sent).not.toContain(
      JSON.stringify({ type: "phase:next", force: true }),
    );
    expect(
      screen.queryByText(FORCE_NEXT_PHASE_COPY.title),
    ).not.toBeInTheDocument();
  });

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

  it("個人付箋をボードへドラッグすると侵入時に公開し、ドロップで位置を確定する", () => {
    const privateNote = protocolNote({
      visibility: "private",
      content: "公開前のメモ",
    });
    const { socket } = connectWithSnapshot([privateNote]);
    const canvas = screen.getByTestId("board-canvas");
    const scroller = canvas.parentElement;
    if (!scroller) throw new Error("ボードスクローラーがありません");
    Object.defineProperty(scroller, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 400 }),
    });

    const toolbar = screen.getByTestId("private-notes-toolbar");
    const handle = within(toolbar).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600, clientY: 20 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 605, clientY: 25 });
    expect(
      within(toolbar).queryByRole("button", { name: "付箋" }),
    ).toBeInTheDocument();
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 120, clientY: 140 });
    expect(within(toolbar).queryByRole("button", { name: "付箋" })).toBeNull();
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 140, clientY: 160 });

    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:publish", noteId: NOTE_ID, x: 120, y: 140 }),
    );
    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:move", noteId: NOTE_ID, x: 140, y: 160 }),
    );
  });

  it("共有応答でマイ付箋が消えても、同じポインター操作で移動・ドロップできる", () => {
    const privateNote = protocolNote({ visibility: "private" });
    const { socket } = connectWithSnapshot([privateNote]);
    const canvas = screen.getByTestId("board-canvas");
    const scroller = canvas.parentElement;
    if (!scroller) throw new Error("ボードスクローラーがありません");
    Object.defineProperty(scroller, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 400 }),
    });

    const toolbar = screen.getByTestId("private-notes-toolbar");
    const handle = within(toolbar).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600, clientY: 20 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 605, clientY: 25 });
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 100, clientY: 120 });

    act(() =>
      socket.simulateServerMessage({
        type: "note:inserted",
        note: protocolNote({ visibility: "shared", x: 100, y: 120 }),
      }),
    );

    fireEvent.pointerMove(root, { pointerId: 1, clientX: 180, clientY: 200 });
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 200, clientY: 220 });

    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:drag", noteId: NOTE_ID, x: 100, y: 120 }),
    );
    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:move", noteId: NOTE_ID, x: 200, y: 220 }),
    );
  });

  it("マイ付箋からボードへ公開した同じポインター操作で、マイ付箋へ戻せる", () => {
    const privateNote = protocolNote({ visibility: "private" });
    const { socket } = connectWithSnapshot([privateNote]);
    const canvas = screen.getByTestId("board-canvas");
    const scroller = canvas.parentElement;
    if (!scroller) throw new Error("ボードスクローラーがありません");
    Object.defineProperty(scroller, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 400 }),
    });
    const toolbar = screen.getByTestId("private-notes-toolbar");
    Object.defineProperty(toolbar, "getBoundingClientRect", {
      value: () => ({ left: 600, top: 0, right: 900, bottom: 600 }),
    });

    const handle = within(toolbar).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 700, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 705, clientY: 105 });
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 120, clientY: 140 });

    act(() =>
      socket.simulateServerMessage({
        type: "note:inserted",
        note: protocolNote({ visibility: "shared", x: 120, y: 140 }),
      }),
    );

    fireEvent.pointerMove(root, { pointerId: 1, clientX: 650, clientY: 120 });
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 650, clientY: 120 });

    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:publish", noteId: NOTE_ID, x: 120, y: 140 }),
    );
    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:unpublish", noteId: NOTE_ID }),
    );
    expect(socket.sent).not.toContain(
      expect.stringContaining('"type":"note:move"'),
    );
  });

  it("マイ付箋からボード→マイ付箋→再びボードへ、一回のドラッグで往復できる", () => {
    const privateNote = protocolNote({ visibility: "private" });
    const { socket } = connectWithSnapshot([privateNote]);
    const canvas = screen.getByTestId("board-canvas");
    const scroller = canvas.parentElement;
    if (!scroller) throw new Error("ボードスクローラーがありません");
    Object.defineProperty(scroller, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 400 }),
    });
    const toolbar = screen.getByTestId("private-notes-toolbar");
    Object.defineProperty(toolbar, "getBoundingClientRect", {
      value: () => ({ left: 600, top: 0, right: 900, bottom: 600 }),
    });

    // 1) ツールバーからドラッグ開始
    const handle = within(toolbar).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 700, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 705, clientY: 105 });

    // 2) ボードへ入る → publish
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 120, clientY: 140 });

    // サーバー応答: shared として追加
    act(() =>
      socket.simulateServerMessage({
        type: "note:inserted",
        note: protocolNote({ visibility: "shared", x: 120, y: 140 }),
      }),
    );

    // 3) ツールバーへ戻す → unpublish
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 650, clientY: 120 });

    // サーバー応答: 削除 → private として戻る
    act(() =>
      socket.simulateServerMessage({ type: "note:deleted", noteId: NOTE_ID }),
    );
    act(() =>
      socket.simulateServerMessage({
        type: "note:inserted",
        note: protocolNote({ visibility: "private" }),
      }),
    );

    // 4) 再びボードへ入る → 2回目の publish
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 200, clientY: 200 });

    // 5) ボード上でドロップ
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 200, clientY: 200 });

    // publish が2回送信されていること
    const publishMessages = socket.sent.filter((message) =>
      message.includes('"type":"note:publish"'),
    );
    expect(publishMessages).toHaveLength(2);

    // unpublish が1回送信されていること
    const unpublishMessages = socket.sent.filter((message) =>
      message.includes('"type":"note:unpublish"'),
    );
    expect(unpublishMessages).toHaveLength(1);

    // 最終的に note:move でドロップ位置を確定していること
    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:move", noteId: NOTE_ID, x: 200, y: 200 }),
    );
  });

  it("ボード外でpointercancelされたマイ付箋は公開せず、後続イベントも無視する", () => {
    const privateNote = protocolNote({ visibility: "private" });
    const { socket } = connectWithSnapshot([privateNote]);
    const canvas = screen.getByTestId("board-canvas");
    const scroller = canvas.parentElement;
    if (!scroller) throw new Error("ボードスクローラーがありません");
    Object.defineProperty(scroller, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 400 }),
    });

    const toolbar = screen.getByTestId("private-notes-toolbar");
    const handle = within(toolbar).getByRole("button", { name: "付箋" });
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600, clientY: 20 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 605, clientY: 25 });
    fireEvent.pointerCancel(root, { pointerId: 1, clientX: 600, clientY: 20 });
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 100, clientY: 120 });

    expect(socket.sent).not.toContain(
      expect.stringContaining('"type":"note:publish"'),
    );
  });

  it("自分の共有付箋をマイ付箋領域へドラッグすると非公開に戻し、note:moveを送らない", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);
    const toolbar = screen.getByTestId("private-notes-toolbar");
    Object.defineProperty(toolbar, "getBoundingClientRect", {
      value: () => ({ left: 600, top: 0, right: 900, bottom: 600 }),
    });

    const note = screen.getByTestId("note-card");
    const surface = within(note).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      clientX: 110,
      clientY: 110,
    });
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerMove(root, {
      pointerId: 1,
      clientX: 620,
      clientY: 120,
    });
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 620, clientY: 120 });

    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:unpublish", noteId: NOTE_ID }),
    );
    expect(socket.sent).not.toContain(
      expect.stringContaining('"type":"note:move"'),
    );
  });

  it("共有付箋をマイ付箋領域へ入れた瞬間に、サーバー応答を待たずリストへ表示を切り替える", () => {
    connectWithSnapshot([protocolNote()]);
    const toolbar = screen.getByTestId("private-notes-toolbar");
    Object.defineProperty(toolbar, "getBoundingClientRect", {
      value: () => ({ left: 600, top: 0, right: 900, bottom: 600 }),
    });

    const canvas = screen.getByTestId("board-canvas");
    const note = within(canvas).getByTestId("note-card");
    const surface = within(note).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      clientX: 110,
      clientY: 110,
    });
    fireEvent.pointerMove(screen.getByTestId("board-view-root"), {
      pointerId: 1,
      clientX: 620,
      clientY: 120,
    });

    expect(within(toolbar).getByTestId("note-card")).toBeInTheDocument();
    expect(within(canvas).queryByTestId("note-card")).not.toBeInTheDocument();
  });

  it("自分の共有付箋をマイ付箋領域へドラッグして非公開に戻し、さらに再びボードへドラッグして公開しドロップ位置を確定できる", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);
    const toolbar = screen.getByTestId("private-notes-toolbar");
    Object.defineProperty(toolbar, "getBoundingClientRect", {
      value: () => ({ left: 600, top: 0, right: 900, bottom: 600 }),
    });
    const canvas = screen.getByTestId("board-canvas");
    const scroller = canvas.parentElement;
    if (!scroller) throw new Error("ボードスクローラーがありません");
    Object.defineProperty(scroller, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 400 }),
    });

    // 1) ボードからドラッグ開始し、ツールバーへ持っていく
    const note = screen.getByTestId("note-card");
    const surface = within(note).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      clientX: 110,
      clientY: 110,
    });
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerMove(root, {
      pointerId: 1,
      clientX: 620,
      clientY: 120,
    });

    // サーバー応答: 削除 → private として戻る
    act(() =>
      socket.simulateServerMessage({ type: "note:deleted", noteId: NOTE_ID }),
    );
    act(() =>
      socket.simulateServerMessage({
        type: "note:inserted",
        note: protocolNote({ visibility: "private" }),
      }),
    );

    // 2) もう一度ボードへ持っていく
    fireEvent.pointerMove(root, {
      pointerId: 1,
      clientX: 150,
      clientY: 150,
    });

    // サーバー応答: shared として追加
    act(() =>
      socket.simulateServerMessage({
        type: "note:inserted",
        note: protocolNote({ visibility: "shared", x: 150, y: 150 }),
      }),
    );

    // 3) ドロップして確定する
    fireEvent.pointerUp(root, { pointerId: 1, clientX: 160, clientY: 160 });

    // unpublish が送られたこと
    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:unpublish", noteId: NOTE_ID }),
    );

    // 2回目の publish が送られたこと
    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:publish", noteId: NOTE_ID, x: 150, y: 150 }),
    );

    // 最終的に note:move で確定すること
    expect(socket.sent).toContain(
      JSON.stringify({ type: "note:move", noteId: NOTE_ID, x: 160, y: 160 }),
    );
  });

  it("他メンバーの付箋をマイ付箋領域へドラッグしても非公開に戻せない", () => {
    const { socket } = connectWithSnapshot([
      protocolNote({ authorId: OTHER_USER_ID }),
    ]);
    const toolbar = screen.getByTestId("private-notes-toolbar");
    Object.defineProperty(toolbar, "getBoundingClientRect", {
      value: () => ({ left: 600, top: 0, right: 900, bottom: 600 }),
    });

    const note = screen.getByTestId("note-card");
    const surface = within(note).getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      clientX: 110,
      clientY: 110,
    });
    expect(toolbar).not.toHaveAttribute("data-return-drop-target");
    const root = screen.getByTestId("board-view-root");
    fireEvent.pointerMove(root, {
      pointerId: 1,
      clientX: 620,
      clientY: 120,
    });

    expect(socket.sent).not.toContain(
      expect.stringContaining('"type":"note:unpublish"'),
    );
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

  it("error メッセージはクラッシュせず警告ログに残る", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { socket } = connectWithSnapshot([]);
    act(() =>
      socket.simulateServerMessage({
        type: "error",
        code: "forbidden",
        message: "この操作を行う権限がありません。",
      }),
    );
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("forbidden"),
    );
  });
});

describe("接続状態 → 画面反映", () => {
  it("接続確立前は接続中の表示になる（loading）", () => {
    renderBoard({ open: false });

    expect(screen.getByRole("status")).toHaveTextContent("接続中");
  });

  it("接続が確立するとインジケータが消える（success）", () => {
    renderBoard();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("予期しない切断で再接続中の表示になる（error）", () => {
    const { socket } = connectWithSnapshot([]);

    act(() => socket.simulateUnexpectedClose());

    expect(screen.getByRole("status")).toHaveTextContent("再接続");
  });

  it("解散による WS close で理由を通知して /home へ router.replace する", () => {
    const { socket } = connectWithSnapshot([]);
    act(() => socket.simulateDisbandedClose());
    expect(notifyMocks.roomDisbanded).toHaveBeenCalledTimes(1);
    expect(navigationMocks.replace).toHaveBeenCalledWith("/home");
    // 再接続メッセージは出さない
    expect(screen.queryByText(/再接続/)).not.toBeInTheDocument();
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

  it("付箋の主観ドットボタンで note:vote が送信される", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);

    fireEvent.click(screen.getByRole("button", { name: "主観ドットを投票" }));

    expect(socket.sent).toContain(
      JSON.stringify({
        type: "note:vote",
        noteId: NOTE_ID,
        kind: "subjective",
      }),
    );
  });

  it("付箋の客観ドットボタンで note:vote が送信される", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);

    fireEvent.click(screen.getByRole("button", { name: "客観ドットを追加" }));

    expect(socket.sent).toContain(
      JSON.stringify({
        type: "note:vote",
        noteId: NOTE_ID,
        kind: "objective",
      }),
    );
  });

  it("客観ドットはサーバー応答前でも残数までしか送信しない", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);
    const button = screen.getByRole("button", { name: "客観ドットを追加" });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(
      socket.sent.filter(
        (message) =>
          message ===
          JSON.stringify({
            type: "note:vote",
            noteId: NOTE_ID,
            kind: "objective",
          }),
      ),
    ).toHaveLength(3);
    expect(screen.getByText("客観 残り0")).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("客観ドット更新のサーバー反映でローカル選択済みの主観ドットを外さない", () => {
    const { socket } = connectWithSnapshot([protocolNote()]);

    fireEvent.click(screen.getByRole("button", { name: "主観ドットを投票" }));
    fireEvent.click(screen.getByRole("button", { name: "客観ドットを追加" }));

    act(() =>
      socket.simulateServerMessage({
        type: "note:updated",
        note: protocolNote({
          dotVotes: {
            subjective: { count: 0, votedByMe: false, ownCount: 0 },
            objective: { count: 1, votedByMe: true, ownCount: 1 },
          },
        }),
      }),
    );

    expect(
      screen.getByRole("button", { name: "主観ドット投票を取り消す" }),
    ).toHaveTextContent("主観1");
  });

  it("付箋の客観ドットリセットボタンで note:vote-reset が送信される", () => {
    const { socket } = connectWithSnapshot([
      protocolNote({
        dotVotes: {
          subjective: { count: 0, votedByMe: false, ownCount: 0 },
          objective: { count: 2, votedByMe: true, ownCount: 2 },
        },
      }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "客観ドットを0に戻す" }),
    );

    expect(socket.sent).toContain(
      JSON.stringify({
        type: "note:vote-reset",
        noteId: NOTE_ID,
        kind: "objective",
      }),
    );
  });

  it("アンマウントで WebSocket を閉じる", () => {
    const { view, socket } = connectWithSnapshot([]);
    view.unmount();
    expect(socket.readyState).toBe(3);
  });

  // room-client.send() は未openだとメッセージを黙って破棄するため、
  // 未接続中は操作自体を無効化し「送ったつもりが届かない」を防ぐ。
  it("接続確立前は「付箋を追加」ボタンが無効化され、クリックしても何も送信されない", () => {
    const { socket } = renderBoard({ open: false });

    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    expect(socket.sent).toHaveLength(0);
  });

  it("予期しない切断後も「付箋を追加」ボタンが無効化され、クリックしても何も送信されない", () => {
    const { socket } = connectWithSnapshot([]);

    act(() => socket.simulateUnexpectedClose());
    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    expect(socket.sent).toHaveLength(0);
  });

  it("ホストが確認後に「次のフェーズへ」を実行すると phase:next が送信される", () => {
    const { socket } = connectWithSnapshot([], {
      isHost: true,
      phase: "phase1",
    });

    fireEvent.click(screen.getByRole("button", { name: "次のフェーズへ" }));

    expect(
      screen.getByText("次のフェーズへ移行しますか？"),
    ).toBeInTheDocument();

    expect(socket.sent).not.toContain(JSON.stringify({ type: "phase:next" }));

    fireEvent.click(screen.getByRole("button", { name: "移行する" }));

    expect(socket.sent).toContain(JSON.stringify({ type: "phase:next" }));
  });
});

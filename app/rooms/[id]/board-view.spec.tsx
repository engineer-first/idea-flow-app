import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";

const ME = "11111111-1111-4111-8111-111111111111";

function setup(overrides: Partial<Parameters<typeof BoardView>[0]> = {}) {
  const props = {
    notes: buildNotes(2),
    inviteCode: "AB12CD",
    inviteUrl: "https://idea-flow.example/invite/AB12CD",
    draggingNoteId: null,
    members: buildMembers(2, ME),
    currentUserId: ME,
    isHost: true,
    phase: "writing" as const,
    onAddNote: vi.fn(),
    onNoteDragStart: vi.fn(),
    onNoteDragMove: vi.fn(),
    onNoteDragEnd: vi.fn(),
    onNoteContentChange: vi.fn(),
    onNoteDelete: vi.fn(),
    connectionStatus: "open" as const,
    ...overrides,
  };

  render(<BoardView {...props} />);

  return props;
}

// カード内の選択・ドラッグ・キー操作を受けるサーフェス（透明なbutton）。
function getNoteSurface(card: HTMLElement) {
  return within(card).getByRole("button", { name: "付箋" });
}

// pointerdown → pointerup を同じ座標で行う「移動なしのクリック」。
function clickNote(card: HTMLElement) {
  const surface = getNoteSurface(card);
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 10, clientY: 10 });
}

describe("BoardView", () => {
  it("招待コードを表示する", () => {
    setup({ inviteCode: "ZZ99XX" });

    expect(screen.getByText("ZZ99XX")).toBeInTheDocument();
  });

  it("招待URLとコピーボタンを表示する", () => {
    setup({ inviteUrl: "https://idea-flow.example/invite/ZZ99XX" });

    expect(
      screen.getByText("https://idea-flow.example/invite/ZZ99XX"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "招待URLをコピー" }),
    ).toBeInTheDocument();
  });

  it("付箋を配置する", () => {
    setup({ notes: buildNotes(3) });

    expect(screen.getAllByTestId("note-card")).toHaveLength(3);
  });

  it("付箋が0件のときは空状態メッセージを表示する", () => {
    setup({ notes: [] });

    expect(screen.getByText("付箋がまだありません")).toBeInTheDocument();
  });

  it("付箋を追加ボタンでonAddNoteを呼ぶ", () => {
    const onAddNote = vi.fn();
    setup({ onAddNote });

    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    expect(onAddNote).toHaveBeenCalledTimes(1);
  });

  describe("接続状態の表示", () => {
    it("接続確立中は接続中の表示を出す（loading）", () => {
      setup({ connectionStatus: "connecting" });

      expect(screen.getByRole("status")).toHaveTextContent("接続中");
    });

    it("切断中は再接続中の表示を出す（error）", () => {
      setup({ connectionStatus: "closed" });

      expect(screen.getByRole("status")).toHaveTextContent("再接続");
    });

    it("接続済みならインジケータを出さない（success）", () => {
      setup({ connectionStatus: "open" });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("未接続時の操作無効化", () => {
    // WebSocket が connecting / closed の間に編集させると、room-client が
    // 送信を黙って破棄するため「入力したのに再接続後のsnapshotで消える」
    // ことになる。未接続中はボタン・付箋の操作自体を無効化する。
    it.each([
      "connecting",
      "closed",
    ] as const)("%sの間は「付箋を追加」ボタンが無効化される", (connectionStatus) => {
      setup({ connectionStatus });

      expect(screen.getByRole("button", { name: "付箋を追加" })).toBeDisabled();
    });

    it("openの間は「付箋を追加」ボタンが有効", () => {
      setup({ connectionStatus: "open" });

      expect(
        screen.getByRole("button", { name: "付箋を追加" }),
      ).not.toBeDisabled();
    });

    it("closedの間は付箋をクリックしても選択されない", () => {
      setup({ connectionStatus: "closed" });

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);

      expect(first).not.toHaveAttribute("data-selected");
    });
  });

  describe("付箋の選択", () => {
    it("付箋をクリックすると選択され、ボード背景のクリックで解除される", () => {
      setup();

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);
      expect(first).toHaveAttribute("data-selected", "true");

      fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
        pointerId: 1,
      });
      expect(first).not.toHaveAttribute("data-selected");
    });

    it("別の付箋をクリックすると選択が移る（同時に選択されるのは1枚だけ）", () => {
      setup();

      const [first, second] = screen.getAllByTestId("note-card");
      clickNote(first);
      clickNote(second);

      expect(first).not.toHaveAttribute("data-selected");
      expect(second).toHaveAttribute("data-selected", "true");
    });

    it("選択済みの付箋をもう一度クリックすると編集モードに入る", () => {
      setup();

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);
      clickNote(first);

      expect(within(first).getByRole("textbox")).toHaveFocus();
    });

    it("選択中の付箋でBackspaceを押すとonNoteDeleteを呼ぶ", () => {
      const onNoteDelete = vi.fn();
      setup({ onNoteDelete });

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);
      fireEvent.keyDown(getNoteSurface(first), { key: "Backspace" });

      expect(onNoteDelete).toHaveBeenCalledWith("note-1");
    });
  });
});

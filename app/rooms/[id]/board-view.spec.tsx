import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";

function setup(overrides: Partial<Parameters<typeof BoardView>[0]> = {}) {
  const props = {
    notes: buildNotes(2),
    inviteCode: "AB12CD",
    inviteUrl: "https://idea-flow.example/invite/AB12CD",
    draggingNoteId: null,
    onAddNote: vi.fn(),
    onNoteDragStart: vi.fn(),
    onNoteDragMove: vi.fn(),
    onNoteDragEnd: vi.fn(),
    onNoteContentChange: vi.fn(),
    onNoteDelete: vi.fn(),
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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";

function setup(overrides: Partial<Parameters<typeof BoardView>[0]> = {}) {
  const props = {
    notes: buildNotes(2),
    inviteCode: "AB12CD",
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

describe("BoardView", () => {
  it("招待コードを表示する", () => {
    setup({ inviteCode: "ZZ99XX" });

    expect(screen.getByText("ZZ99XX")).toBeInTheDocument();
  });

  it("付箋を配置する", () => {
    setup({ notes: buildNotes(3) });

    expect(screen.getAllByTestId("note-drag-handle")).toHaveLength(3);
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
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteCard } from "@/app/rooms/[id]/note-card";
import { buildNote } from "@/app/rooms/[id]/note-card.fixture";

function setup(overrides: Partial<Parameters<typeof NoteCard>[0]> = {}) {
  const props = {
    note: buildNote(),
    isOwnDrag: false,
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
    onContentChange: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };

  render(<NoteCard {...props} />);

  return props;
}

describe("NoteCard", () => {
  it("付箋の本文を表示する", () => {
    setup({ note: buildNote({ content: "こんにちは" }) });

    expect(screen.getByDisplayValue("こんにちは")).toBeInTheDocument();
  });

  it("本文からフォーカスが外れるとonContentChangeを呼ぶ", () => {
    const onContentChange = vi.fn();
    setup({ onContentChange });

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "更新後の本文" } });
    fireEvent.blur(textarea);

    expect(onContentChange).toHaveBeenCalledWith("note-1", "更新後の本文");
  });

  it("削除ボタンでonDeleteを呼ぶ", () => {
    const onDelete = vi.fn();
    setup({ onDelete });

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(onDelete).toHaveBeenCalledWith("note-1");
  });

  it("ドラッグハンドルのポインター操作でonDragStart/onDragMove/onDragEndを呼ぶ", () => {
    const onDragStart = vi.fn();
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    setup({
      note: buildNote({ x: 100, y: 100 }),
      onDragStart,
      onDragMove,
      onDragEnd,
    });

    const handle = screen.getByTestId("note-drag-handle");

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    expect(onDragStart).toHaveBeenCalledWith("note-1");

    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 80,
      clientY: 70,
    });
    expect(onDragMove).toHaveBeenCalledWith("note-1", 130, 120);

    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 90,
      clientY: 65,
    });
    expect(onDragEnd).toHaveBeenCalledWith("note-1", 140, 115);
  });

  it("ドラッグ開始前のポインター移動は無視する", () => {
    const onDragMove = vi.fn();
    setup({ onDragMove });

    const handle = screen.getByTestId("note-drag-handle");
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 999, clientY: 999 });

    expect(onDragMove).not.toHaveBeenCalled();
  });
});

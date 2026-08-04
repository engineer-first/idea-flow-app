import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildNote } from "@/contracts/room-protocol.fixture";
import { NOTE_COLOR_STYLES } from "@/features/room-members";
import { PrivateNotesToolbar } from "./private-notes-toolbar";

function setup(disabled = false) {
  const props = {
    notes: [buildNote({ visibility: "private", content: "非公開の考え" })],
    disabled,
    selectedNoteId: null,
    canCreateNote: true,
    canDeleteNote: true,
    canMoveNote: true,
    canEditNote: true,
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onContentChange: vi.fn(),
    onDelete: vi.fn(),
    onDragStart: vi.fn(),
  };
  render(<PrivateNotesToolbar {...props} />);
  return props;
}

describe("PrivateNotesToolbar", () => {
  it("個人付箋を表示し、追加と削除を操作できる", () => {
    const props = setup();
    expect(screen.getByDisplayValue("非公開の考え")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    const surface = screen.getByRole("button", { name: "付箋" });
    fireEvent.keyDown(surface, { key: "Backspace" });

    expect(props.onAdd).toHaveBeenCalledOnce();
    expect(props.onDelete).toHaveBeenCalledWith("note-1");
  });

  it("ボード付箋と同じ付箋スタイルで表示し、投票UIは表示しない", () => {
    setup();

    const note = screen.getByTestId("note-card");
    expect(note).toHaveAttribute("data-slot", "sticky-note");
    expect(note).toHaveStyle({
      backgroundColor: NOTE_COLOR_STYLES.yellow.backgroundColor,
    });
    expect(
      screen.queryByRole("button", { name: "主観ドットを投票" }),
    ).not.toBeInTheDocument();
  });

  it("下部ドック用に付箋を横並び・横スクロールで表示する", () => {
    const props = {
      notes: [
        buildNote({ id: "note-1", visibility: "private" }),
        buildNote({ id: "note-2", visibility: "private" }),
      ],
      disabled: false,
      selectedNoteId: null,
      canCreateNote: true,
      canDeleteNote: true,
      canMoveNote: true,
      canEditNote: true,
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onContentChange: vi.fn(),
      onDelete: vi.fn(),
      onDragStart: vi.fn(),
    };
    render(<PrivateNotesToolbar {...props} />);

    const toolbar = screen.getByTestId("private-notes-toolbar");
    expect(toolbar).toHaveClass("flex-row");
    expect(within(toolbar).getByTestId("private-notes-scroll")).toHaveClass(
      "overflow-x-auto",
    );
    expect(within(toolbar).getByTestId("private-notes-list")).toHaveClass(
      "flex",
      "flex-nowrap",
    );
    expect(within(toolbar).getAllByTestId("note-card")[0]).toHaveClass(
      "shrink-0",
    );
  });

  it("本文はフォーカスを外した時に保存する", () => {
    const props = {
      notes: [buildNote({ visibility: "private", content: "非公開の考え" })],
      disabled: false,
      selectedNoteId: "note-1",
      canCreateNote: true,
      canDeleteNote: true,
      canMoveNote: true,
      canEditNote: true,
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onContentChange: vi.fn(),
      onDelete: vi.fn(),
      onDragStart: vi.fn(),
    };
    render(<PrivateNotesToolbar {...props} />);

    const surface = screen.getByRole("button", { name: "付箋" });
    fireEvent.click(surface);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "書き換えた内容" } });
    fireEvent.blur(textarea);

    expect(props.onContentChange).toHaveBeenCalledWith(
      "note-1",
      "書き換えた内容",
    );
  });

  it("切断中は追加・編集・削除を無効化する", () => {
    const props = {
      notes: [buildNote({ visibility: "private", content: "非公開 of考え" })],
      disabled: true,
      selectedNoteId: null,
      canCreateNote: true,
      canDeleteNote: true,
      canMoveNote: true,
      canEditNote: true,
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onContentChange: vi.fn(),
      onDelete: vi.fn(),
      onDragStart: vi.fn(),
    };
    render(<PrivateNotesToolbar {...props} />);

    expect(screen.getByRole("button", { name: "付箋を追加" })).toBeDisabled();

    const surface = screen.getByRole("button", { name: "付箋" });
    expect(surface).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("editingDisabled中はマイ付箋の編集開始を無効化する", () => {
    const props = {
      notes: [buildNote({ visibility: "private", content: "非公開の考え" })],
      disabled: false,
      editingDisabled: true,
      selectedNoteId: "note-1",
      canCreateNote: true,
      canDeleteNote: true,
      canMoveNote: true,
      canEditNote: true,
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onContentChange: vi.fn(),
      onDelete: vi.fn(),
      onDragStart: vi.fn(),
    };
    render(<PrivateNotesToolbar {...props} />);

    const surface = screen.getByRole("button", { name: "付箋" });
    fireEvent.pointerDown(surface, { pointerId: 1 });
    fireEvent.pointerUp(surface, { pointerId: 1 });

    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("canCreateNoteがfalseの場合は追加ボタンを無効化する", () => {
    render(
      <PrivateNotesToolbar
        notes={[]}
        disabled={false}
        canCreateNote={false}
        canMoveNote={true}
        canEditNote={true}
        canDeleteNote={false}
        selectedNoteId={null}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onContentChange={vi.fn()}
        onDelete={vi.fn()}
        onDragStart={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "付箋を追加" })).toBeDisabled();
  });

  it("canEditNoteがfalseの場合は編集できない", () => {
    render(
      <PrivateNotesToolbar
        notes={[buildNote({ visibility: "private" })]}
        disabled={false}
        canCreateNote={true}
        canMoveNote={true}
        canEditNote={false}
        canDeleteNote={false}
        selectedNoteId={null}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onContentChange={vi.fn()}
        onDelete={vi.fn()}
        onDragStart={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("canDeleteNoteがfalseの場合はBackspace/Deleteで削除できない", () => {
    const onDelete = vi.fn();

    render(
      <PrivateNotesToolbar
        notes={[buildNote({ visibility: "private" })]}
        disabled={false}
        canCreateNote={true}
        canMoveNote={true}
        canEditNote={true}
        canDeleteNote={false}
        selectedNoteId={null}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onContentChange={vi.fn()}
        onDelete={onDelete}
        onDragStart={vi.fn()}
      />,
    );

    const surface = screen.getByRole("button", { name: "付箋" });

    fireEvent.keyDown(surface, { key: "Backspace" });
    fireEvent.keyDown(surface, { key: "Delete" });

    expect(onDelete).not.toHaveBeenCalled();
  });
});

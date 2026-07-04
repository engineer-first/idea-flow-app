import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteCard } from "@/app/rooms/[id]/note-card";
import { buildNote } from "@/app/rooms/[id]/note-card.fixture";

function setup(overrides: Partial<Parameters<typeof NoteCard>[0]> = {}) {
  const props = {
    note: buildNote(),
    isOwnDrag: false,
    isSelected: false,
    onSelect: vi.fn(),
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
    onContentChange: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };

  const view = render(<NoteCard {...props} />);

  return { props, view };
}

function getCard() {
  return screen.getByTestId("note-card");
}

// 選択・ドラッグ・キー操作を受けるサーフェス（カードに重ねた透明なbutton）。
function getNoteSurface() {
  return screen.getByRole("button", { name: "付箋" });
}

// pointerdown → pointerup を同じ座標で行う「移動なしのクリック」。
function clickNote(clientX = 10, clientY = 10) {
  const surface = getNoteSurface();
  fireEvent.pointerDown(surface, { pointerId: 1, clientX, clientY });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX, clientY });
}

describe("NoteCard", () => {
  it("付箋の本文を表示する", () => {
    setup({ note: buildNote({ content: "こんにちは" }) });

    expect(screen.getByDisplayValue("こんにちは")).toBeInTheDocument();
  });

  describe("選択", () => {
    it("未選択の付箋はpointerdownでonSelectを呼ぶ", () => {
      const onSelect = vi.fn();
      setup({ onSelect });

      fireEvent.pointerDown(getNoteSurface(), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });

      expect(onSelect).toHaveBeenCalledWith("note-1");
    });

    it("選択状態はdata-selected属性で見た目に反映される", () => {
      setup({ isSelected: true });

      expect(getCard()).toHaveAttribute("data-selected", "true");
    });

    it("未選択時はdata-selected属性が付かない", () => {
      setup({ isSelected: false });

      expect(getCard()).not.toHaveAttribute("data-selected");
    });
  });

  describe("編集モード", () => {
    it("選択済みの付箋をクリックすると編集モードに入りtextareaへフォーカスが移る", () => {
      setup({ isSelected: true });

      clickNote();

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveFocus();
      expect(textarea).not.toHaveAttribute("readonly");
    });

    it("未選択の付箋のクリックでは編集モードに入らない", () => {
      setup({ isSelected: false });

      clickNote();

      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    });

    it("選択中にEnterで編集モードに入る", () => {
      setup({ isSelected: true });

      fireEvent.keyDown(getNoteSurface(), { key: "Enter" });

      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("編集してフォーカスが外れるとonContentChangeを呼び編集モードを終了する", () => {
      const onContentChange = vi.fn();
      setup({ isSelected: true, onContentChange });

      clickNote();
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "更新後の本文" } });
      fireEvent.blur(textarea);

      expect(onContentChange).toHaveBeenCalledWith("note-1", "更新後の本文");
      expect(textarea).toHaveAttribute("readonly");
    });

    it("編集中にEscapeで編集モードを終了しサーフェスへフォーカスを戻す", () => {
      setup({ isSelected: true });

      clickNote();
      const textarea = screen.getByRole("textbox");
      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(textarea).toHaveAttribute("readonly");
      expect(getNoteSurface()).toHaveFocus();
    });
  });

  describe("キーボード削除", () => {
    it("選択中（非編集）にBackspaceでonDeleteを呼ぶ", () => {
      const onDelete = vi.fn();
      setup({ isSelected: true, onDelete });

      fireEvent.keyDown(getNoteSurface(), { key: "Backspace" });

      expect(onDelete).toHaveBeenCalledWith("note-1");
    });

    it("選択中（非編集）にDeleteでonDeleteを呼ぶ", () => {
      const onDelete = vi.fn();
      setup({ isSelected: true, onDelete });

      fireEvent.keyDown(getNoteSurface(), { key: "Delete" });

      expect(onDelete).toHaveBeenCalledWith("note-1");
    });

    it("編集中のBackspaceは文字削除でありonDeleteを呼ばない", () => {
      const onDelete = vi.fn();
      setup({ isSelected: true, onDelete });

      clickNote();
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Backspace" });

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe("ドラッグ", () => {
    it("閾値を超えるポインター移動でonDragStart/onDragMove/onDragEndを呼ぶ", () => {
      const onDragStart = vi.fn();
      const onDragMove = vi.fn();
      const onDragEnd = vi.fn();
      setup({
        note: buildNote({ x: 100, y: 100 }),
        onDragStart,
        onDragMove,
        onDragEnd,
      });

      const surface = getNoteSurface();

      fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 50,
        clientY: 50,
      });
      expect(onDragStart).not.toHaveBeenCalled();

      fireEvent.pointerMove(surface, {
        pointerId: 1,
        clientX: 80,
        clientY: 70,
      });
      expect(onDragStart).toHaveBeenCalledWith("note-1");
      expect(onDragMove).toHaveBeenCalledWith("note-1", 130, 120);

      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 90, clientY: 65 });
      expect(onDragEnd).toHaveBeenCalledWith("note-1", 140, 115);
    });

    it("閾値内の移動はクリック扱いでドラッグイベントを発火しない", () => {
      const onDragStart = vi.fn();
      const onDragMove = vi.fn();
      const onDragEnd = vi.fn();
      setup({ onDragStart, onDragMove, onDragEnd });

      const surface = getNoteSurface();
      fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 50,
        clientY: 50,
      });
      fireEvent.pointerMove(surface, {
        pointerId: 1,
        clientX: 52,
        clientY: 51,
      });
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 52, clientY: 51 });

      expect(onDragStart).not.toHaveBeenCalled();
      expect(onDragMove).not.toHaveBeenCalled();
      expect(onDragEnd).not.toHaveBeenCalled();
    });

    it("ドラッグ後のpointerupでは選択済みでも編集モードに入らない", () => {
      setup({ isSelected: true });

      const surface = getNoteSurface();
      fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 50,
        clientY: 50,
      });
      fireEvent.pointerMove(surface, {
        pointerId: 1,
        clientX: 80,
        clientY: 70,
      });
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 80, clientY: 70 });

      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    });

    it("ドラッグ開始前のポインター移動は無視する", () => {
      const onDragMove = vi.fn();
      setup({ onDragMove });

      fireEvent.pointerMove(getNoteSurface(), {
        pointerId: 1,
        clientX: 999,
        clientY: 999,
      });

      expect(onDragMove).not.toHaveBeenCalled();
    });
  });

  describe("他ユーザーの更新の反映", () => {
    it("非編集時はnote.contentの更新を本文へ反映する", () => {
      const { props, view } = setup();

      view.rerender(
        <NoteCard {...props} note={buildNote({ content: "他人の更新" })} />,
      );

      expect(screen.getByDisplayValue("他人の更新")).toBeInTheDocument();
    });

    it("編集中はnote.contentの更新で本文を上書きしない", () => {
      const { props, view } = setup({ isSelected: true });

      clickNote();
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "編集中の本文" },
      });

      view.rerender(
        <NoteCard
          {...props}
          isSelected
          note={buildNote({ content: "他人の更新" })}
        />,
      );

      expect(screen.getByDisplayValue("編集中の本文")).toBeInTheDocument();
    });
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteCard } from "@/app/rooms/[id]/note-card";
import { buildNote } from "@/app/rooms/[id]/note-card.fixture";
import { NOTE_CONTENT_MAX_LENGTH } from "@/contracts/room-protocol";

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
    voteRemaining: { subjective: 1, objective: 3 },
    onVote: vi.fn(),
    onVoteReset: vi.fn(),
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

  it("本文の入力はコントラクトの上限文字数で制限される", () => {
    // サーバー（RoomDO）は上限超過を invalid-message で黙って拒否するため、
    // UI 側で制限しないと「本人にだけ保存されて見える」分岐が起きる。
    setup();

    expect(screen.getByRole("textbox")).toHaveAttribute(
      "maxlength",
      String(NOTE_CONTENT_MAX_LENGTH),
    );
  });

  describe("ドット投票", () => {
    it("主観・客観ドットの集計を表示する", () => {
      setup({
        note: buildNote({
          dotVotes: {
            subjective: { count: 1, votedByMe: false, ownCount: 0 },
            objective: { count: 2, votedByMe: true, ownCount: 2 },
          },
        }),
      });

      expect(
        screen.getByRole("button", { name: "主観ドットを投票" }),
      ).toHaveTextContent("主観1");
      expect(
        screen.getByRole("button", { name: "客観ドットを追加" }),
      ).toHaveTextContent("客観2");
      expect(
        screen.getByRole("button", { name: "客観ドットを0に戻す" }),
      ).toBeInTheDocument();
    });

    it("ドット投票ボタンでonVoteを呼ぶ", () => {
      const onVote = vi.fn();
      setup({ onVote });

      fireEvent.click(screen.getByRole("button", { name: "主観ドットを投票" }));

      expect(onVote).toHaveBeenCalledWith("note-1", "subjective");
    });

    it("残数が0の未投票ドットは投票できない", () => {
      const onVote = vi.fn();
      setup({
        voteRemaining: { subjective: 0, objective: 3 },
        onVote,
      });

      const button = screen.getByRole("button", { name: "主観ドットを投票" });
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(onVote).not.toHaveBeenCalled();
    });

    it("客観ドットは投票済みでも残数があれば同じ付箋に加算できる", () => {
      const onVote = vi.fn();
      setup({
        note: buildNote({
          dotVotes: {
            subjective: { count: 0, votedByMe: false, ownCount: 0 },
            objective: { count: 1, votedByMe: true, ownCount: 1 },
          },
        }),
        voteRemaining: { subjective: 1, objective: 2 },
        onVote,
      });

      fireEvent.click(screen.getByRole("button", { name: "客観ドットを追加" }));

      expect(onVote).toHaveBeenCalledWith("note-1", "objective");
    });

    it("客観ドットのリセットボタンでonVoteResetを呼ぶ", () => {
      const onVoteReset = vi.fn();
      setup({
        note: buildNote({
          dotVotes: {
            subjective: { count: 0, votedByMe: false, ownCount: 0 },
            objective: { count: 2, votedByMe: true, ownCount: 2 },
          },
        }),
        onVoteReset,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "客観ドットを0に戻す" }),
      );

      expect(onVoteReset).toHaveBeenCalledWith("note-1", "objective");
    });
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

    it("Escapeでの編集終了でも編集内容は保存される（キャンセルではなくコミット）", () => {
      // tldraw の Note shape 踏襲: Escape は「編集の完了」であり、blur と同じく
      // 内容を確定する。誤って Escape を押したときに入力が消えるのを防ぐ意図。
      const onContentChange = vi.fn();
      setup({ isSelected: true, onContentChange });

      clickNote();
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "編集した本文" } });
      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(onContentChange).toHaveBeenCalledWith("note-1", "編集した本文");
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

  describe("無効化（未接続時）", () => {
    // WebSocket が connecting / closed の間は、操作してもサーバーに
    // 届かず（room-client が握りつぶす）画面だけ変化してしまう。
    // それを防ぐため disabled=true の間は選択・ドラッグ・編集開始・削除を
    // すべて無効化する。
    it("disabled中のpointerdownはonSelectを呼ばない", () => {
      const onSelect = vi.fn();
      setup({ disabled: true, onSelect });

      fireEvent.pointerDown(getNoteSurface(), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("disabled中はドラッグしてもonDragStart/onDragMove/onDragEndを呼ばない", () => {
      const onDragStart = vi.fn();
      const onDragMove = vi.fn();
      const onDragEnd = vi.fn();
      setup({
        disabled: true,
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
      fireEvent.pointerMove(surface, {
        pointerId: 1,
        clientX: 80,
        clientY: 70,
      });
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 80, clientY: 70 });

      expect(onDragStart).not.toHaveBeenCalled();
      expect(onDragMove).not.toHaveBeenCalled();
      expect(onDragEnd).not.toHaveBeenCalled();
    });

    it("disabled中は選択済みでもEnterで編集モードに入らない", () => {
      setup({ disabled: true, isSelected: true });

      fireEvent.keyDown(getNoteSurface(), { key: "Enter" });

      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    });

    it("disabled中は選択済みでもBackspace/DeleteでonDeleteを呼ばない", () => {
      const onDelete = vi.fn();
      setup({ disabled: true, isSelected: true, onDelete });

      fireEvent.keyDown(getNoteSurface(), { key: "Backspace" });
      fireEvent.keyDown(getNoteSurface(), { key: "Delete" });

      expect(onDelete).not.toHaveBeenCalled();
    });

    it("編集中に切断されると編集を強制終了し、onContentChangeを呼ばずに本文を巻き戻す", () => {
      const onContentChange = vi.fn();
      const { props, view } = setup({
        isSelected: true,
        onContentChange,
        note: buildNote({ content: "サーバー上の本文" }),
      });

      clickNote();
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "未送信の下書き" },
      });

      view.rerender(<NoteCard {...props} disabled />);

      expect(onContentChange).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
      expect(screen.getByDisplayValue("サーバー上の本文")).toBeInTheDocument();
    });

    it("disabled中に手動でblurしてもonContentChangeを呼ばない", () => {
      const onContentChange = vi.fn();
      setup({ isSelected: true, disabled: true, onContentChange });

      const textarea = screen.getByRole("textbox");
      fireEvent.blur(textarea);

      expect(onContentChange).not.toHaveBeenCalled();
    });

    it("付箋のサーフェスにaria-disabledが付く", () => {
      setup({ disabled: true });

      expect(getNoteSurface()).toHaveAttribute("aria-disabled", "true");
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

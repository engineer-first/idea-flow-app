import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildPhaseStep } from "@/contracts/phase.fixture";
import {
  buildDecision,
  buildNote,
  buildNotes,
} from "@/contracts/room-protocol.fixture";
import { RoomBoardCanvas } from "./room-board-canvas";

function setup(overrides: Partial<Parameters<typeof RoomBoardCanvas>[0]> = {}) {
  const props = {
    notes: buildNotes(2),
    groups: [],
    phase: buildPhaseStep(1),
    decision: null,
    isHost: false,
    privateNotes: [],
    selectedNoteId: null,
    draggingNoteId: null,
    isDisconnected: false,
    voteRemaining: { subjective: 5, objective: 10 },
    dragGhost: null,
    isReturnDropTarget: false,
    boardScrollerRef: createRef<HTMLDivElement>(),
    privateToolbarRef: createRef<HTMLDivElement>(),
    onSelect: vi.fn(),
    onNoteDragStart: vi.fn(),
    onNoteContentChange: vi.fn(),
    onNoteDelete: vi.fn(),
    onNoteVote: vi.fn(),
    onNoteVoteReset: vi.fn(),
    onNoteDecide: vi.fn(),
    onGroupCreate: vi.fn(),
    onGroupUpdateName: vi.fn(),
    onAddPrivateNote: vi.fn(),
    onPrivateNoteContentChange: vi.fn(),
    onPrivateNoteDelete: vi.fn(),
    onPrivateNoteDragStart: vi.fn(),
    ...overrides,
  };
  render(<RoomBoardCanvas {...props} />);
  return props;
}

describe("RoomBoardCanvas", () => {
  it("付箋を配置する（success）", () => {
    setup({ notes: buildNotes(3) });

    expect(screen.getAllByTestId("note-card")).toHaveLength(3);
  });

  it("付箋が 0 件のときは空状態メッセージを表示する（empty）", () => {
    setup({ notes: [] });

    expect(screen.getByText("共有付箋はまだありません")).toBeInTheDocument();
  });

  it("ボード背景を直接押すと onSelect(null) で選択を解除する", () => {
    const onSelect = vi.fn();
    setup({ onSelect });

    fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
      pointerId: 1,
    });

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("近接する付箋からグループ枠を描画する", () => {
    setup({
      phase: buildPhaseStep(3),
      notes: [
        buildNote({ id: "note-1", x: 100, y: 100 }),
        buildNote({ id: "note-2", x: 350, y: 100 }),
      ],
    });

    expect(screen.getByTestId("note-group-card")).toBeInTheDocument();
  });

  it("Step 1-2 では近接する付箋のグループ枠を描画しない", () => {
    setup({
      phase: buildPhaseStep(2),
      notes: [
        buildNote({ id: "note-1", x: 100, y: 100 }),
        buildNote({ id: "note-2", x: 350, y: 100 }),
      ],
      groups: [
        { id: "group-1", name: "既存グループ", noteIds: ["note-1", "note-2"] },
      ],
    });

    expect(screen.queryByTestId("note-group-card")).not.toBeInTheDocument();
  });

  it("Step 1-4 では近接する付箋のグループ枠を描画する", () => {
    setup({
      phase: buildPhaseStep(4),
      notes: [
        buildNote({ id: "note-1", x: 100, y: 100 }),
        buildNote({ id: "note-2", x: 350, y: 100 }),
      ],
    });

    expect(screen.getByTestId("note-group-card")).toBeInTheDocument();
  });

  it("ドラッグ中のゴースト付箋を描画する", () => {
    const ghost = buildNote({ id: "ghost-note", content: "運んでいる付箋" });
    setup({ dragGhost: { note: ghost, x: 120, y: 80 } });

    expect(screen.getByText("運んでいる付箋")).toBeInTheDocument();
  });

  it("マイ付箋ツールバーの「付箋を追加」で onAddPrivateNote を呼ぶ", () => {
    const onAddPrivateNote = vi.fn();
    setup({ onAddPrivateNote });

    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    expect(onAddPrivateNote).toHaveBeenCalledTimes(1);
  });

  it("未接続中（error）は付箋の操作が無効化される", () => {
    setup({ isDisconnected: true });

    expect(screen.getByRole("button", { name: "付箋を追加" })).toBeDisabled();
  });

  describe("決定操作", () => {
    it("ホストが結果ステップで選択した付箋の決定ボタンを表示し、押下を通知する", () => {
      const onNoteDecide = vi.fn();
      setup({
        phase: buildPhaseStep(5),
        isHost: true,
        selectedNoteId: "note-1",
        onNoteDecide,
      });

      fireEvent.click(
        screen.getByRole("button", {
          name: "これを「取り組む課題」に決定",
        }),
      );
      expect(onNoteDecide).toHaveBeenCalledWith("note-1");
    });

    it.each([
      { phase: buildPhaseStep(5), isHost: false },
      { phase: buildPhaseStep(4), isHost: true },
    ])("非ホストまたは結果ステップ以外では決定ボタンを表示しない", ({
      phase,
      isHost,
    }) => {
      setup({ phase, isHost, selectedNoteId: "note-1" });

      expect(
        screen.queryByRole("button", {
          name: "これを「取り組む課題」に決定",
        }),
      ).not.toBeInTheDocument();
    });

    it("現在の決定と一致する付箋を強調する", () => {
      setup({
        decision: buildDecision({
          noteId: "note-1",
          decidedBy: "11111111-1111-4111-8111-111111111111",
        }),
      });

      expect(screen.getAllByText("取り組む課題")).toHaveLength(1);
    });
  });
});

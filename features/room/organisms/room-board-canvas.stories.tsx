import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { createRef } from "react";
import { fn } from "storybook/test";
import type { RoomStepPhase } from "@/contracts/phase";
import { buildNote, buildNotes } from "@/contracts/room-protocol.fixture";
import { RoomBoardCanvas } from "./room-board-canvas";

const STEP_1_1: RoomStepPhase = { kind: "step", phase: 1, step: 1 };
const STEP_1_2: RoomStepPhase = { kind: "step", phase: 1, step: 2 };
const STEP_1_3: RoomStepPhase = { kind: "step", phase: 1, step: 3 };

const meta = {
  title: "Room/RoomBoardCanvas",
  component: RoomBoardCanvas,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    notes: buildNotes(3),
    groups: [],
    phase: STEP_1_1,
    privateNotes: [],
    selectedNoteId: null,
    draggingNoteId: null,
    isDisconnected: false,
    voteRemaining: { subjective: 5, objective: 10 },
    dragGhost: null,
    isReturnDropTarget: false,
    boardScrollerRef: createRef<HTMLDivElement>(),
    privateToolbarRef: createRef<HTMLDivElement>(),
    onSelect: fn(),
    onNoteDragStart: fn(),
    onNoteContentChange: fn(),
    onNoteDelete: fn(),
    onNoteVote: fn(),
    onNoteVoteReset: fn(),
    onGroupCreate: fn(),
    onGroupUpdateName: fn(),
    onAddPrivateNote: fn(),
    onPrivateNoteContentChange: fn(),
    onPrivateNoteDelete: fn(),
    onPrivateNoteDragStart: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ height: "80vh", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomBoardCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

// success相当: 付箋が配置されている状態。
export const WithNotes: Story = {};

// empty相当: まだ誰も付箋を置いていない状態。
export const Empty: Story = {
  args: {
    notes: [],
  },
};

// 近接する付箋がグループ枠にまとまっている状態。
export const Grouped: Story = {
  args: {
    phase: STEP_1_3,
    notes: [
      buildNote({ id: "note-1", x: 100, y: 100 }),
      buildNote({ id: "note-2", x: 350, y: 100 }),
    ],
    groups: [{ id: "g1", name: "課題グループ", noteIds: ["note-1", "note-2"] }],
  },
};

// Step 1-2 では永続グループが存在しても枠を表示しない。
export const GroupsHiddenBeforeGrouping: Story = {
  args: {
    phase: STEP_1_2,
    notes: [
      buildNote({ id: "note-1", x: 100, y: 100 }),
      buildNote({ id: "note-2", x: 350, y: 100 }),
    ],
    groups: [{ id: "g1", name: "課題グループ", noteIds: ["note-1", "note-2"] }],
  },
};

// ツールバー発ドラッグの途中（ゴースト付箋が持ち上がって見える）。
export const DraggingGhost: Story = {
  args: {
    dragGhost: {
      note: buildNote({ id: "ghost", content: "運んでいる付箋" }),
      x: 240,
      y: 160,
    },
  },
};

// マイ付箋ドックに付箋が並んでいる状態。
export const WithPrivateNotes: Story = {
  args: {
    privateNotes: buildNotes(2).map((note) => ({
      ...note,
      visibility: "private" as const,
    })),
  },
};

// error相当: 未接続中は付箋の操作が無効化される。
export const Disconnected: Story = {
  args: {
    isDisconnected: true,
  },
};

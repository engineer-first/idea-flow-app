import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";

const meta = {
  title: "Rooms/BoardView",
  component: BoardView,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    notes: buildNotes(3),
    inviteCode: "AB12CD",
    draggingNoteId: null,
    onAddNote: fn(),
    onNoteDragStart: fn(),
    onNoteDragMove: fn(),
    onNoteDragEnd: fn(),
    onNoteContentChange: fn(),
    onNoteDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ height: "80vh", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BoardView>;

export default meta;
type Story = StoryObj<typeof meta>;

// success相当: 付箋が配置されている状態。
export const WithNotes: Story = {};

// empty相当: ルーム作成直後、まだ誰も付箋を置いていない状態。
export const Empty: Story = {
  args: {
    notes: [],
  },
};

// 自分がドラッグ中の付箋がある状態（影が深くなり「持ち上げた」見た目になる）。
export const Dragging: Story = {
  args: {
    draggingNoteId: "note-1",
  },
};

// 付箋がボード上に密集している状態（スクロールの確認用）。
export const ManyNotes: Story = {
  args: {
    notes: buildNotes(12),
  },
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";

const ME = "11111111-1111-4111-8111-111111111111";

const meta = {
  title: "Rooms/BoardView",
  component: BoardView,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    notes: buildNotes(3),
    inviteCode: "AB12CD",
    inviteUrl: "https://idea-flow.example/invite/AB12CD",
    connectionStatus: "open",
    draggingNoteId: null,
    members: buildMembers(3, ME),
    currentUserId: ME,
    isHost: true,
    phase: "writing",
    onAddNote: fn(),
    onNoteDragStart: fn(),
    onNoteDragMove: fn(),
    onNoteDragEnd: fn(),
    onNoteContentChange: fn(),
    onNoteDelete: fn(),
    onLeave: fn(),
    isLeaving: false,
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

// 参加者が多い状態（メンバー一覧の +N 省略が発火する）。
export const ManyMembers: Story = {
  args: {
    members: buildMembers(10, ME),
  },
};

// 非ホストの状態（ホストバッジなし、メンバー一覧に「あなた」リングあり）。
export const NonHost: Story = {
  args: {
    isHost: false,
  },
};

// loading相当: WebSocket 接続の確立中（初回接続時。snapshot 未着なので付箋も空）。
export const Connecting: Story = {
  args: {
    notes: [],
    connectionStatus: "connecting",
  },
};

// error相当: 予期しない切断から自動再接続を待っている状態。
export const Reconnecting: Story = {
  args: {
    connectionStatus: "closed",
  },
};

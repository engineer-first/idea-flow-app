import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
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
    inviteUrl: "https://idea-flow.example/invite/AB12CD",
    phase: "phase1",
    isHost: false,
    connectionStatus: "open",
    draggingNoteId: null,
    isNextPhasePending: false,
    onAddNote: fn(),
    onNoteDragStart: fn(),
    onNoteDragMove: fn(),
    onNoteDragEnd: fn(),
    onNoteContentChange: fn(),
    onNoteDelete: fn(),
    onNoteVote: fn(),
    onNoteVoteReset: fn(),
    onNextPhase: fn(),
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

export const DotVoting: Story = {
  args: {
    notes: buildNotes(3).map((note, index) => ({
      ...note,
      dotVotes: {
        subjective: {
          count: index === 0 ? 1 : 0,
          votedByMe: index === 0,
          ownCount: index === 0 ? 1 : 0,
        },
        objective: {
          count: index + 1,
          votedByMe: index < 2,
          ownCount: index < 2 ? 1 : 0,
        },
      },
    })),
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

// ホストがフェーズ移行操作を行える状態。
export const HostCanMovePhase: Story = {
  args: {
    isHost: true,
    phase: "phase1",
  },
};

// 「次のフェーズへ」押下後、確認ダイアログが表示されている状態。
export const NextPhaseConfirmDialog: Story = {
  args: {
    isHost: true,
    phase: "phase1",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", {
        name: "次のフェーズへ",
      }),
    );
  },
};

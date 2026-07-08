import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";
import { StartRoomView } from "@/app/rooms/[id]/start/start-room-view";

const ME = "11111111-1111-4111-8111-111111111111";

const meta = {
  title: "Rooms/StartRoomView",
  component: StartRoomView,
  parameters: { layout: "fullscreen" },
  args: {
    members: buildMembers(3, ME),
    currentUserId: ME,
    isHost: true,
    phase: "lobby",
    inviteCode: "AB12CD",
    inviteUrl: "https://idea-flow.example/invite/AB12CD",
    connectionStatus: "open",
    isStarting: false,
    onStart: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ height: "80vh", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StartRoomView>;

export default meta;
type Story = StoryObj<typeof meta>;

// ホストが入ってすぐの状態。
export const Host: Story = {};

// メンバー多数のホスト状態（+N 省略が発火）。
export const HostMany: Story = {
  args: { members: buildMembers(10, ME) },
};

// 参加者（ホストではない）の状態。
export const NonHost: Story = {
  args: { isHost: false },
};

// 開始処理中の状態（ボタン disabled・文言「開始中…」）。
export const Starting: Story = {
  args: { isStarting: true },
};

// 接続が切れている状態。
export const Reconnecting: Story = {
  args: { connectionStatus: "closed" },
};

// 自分一人の状態。
export const Solo: Story = {
  args: { members: buildMembers(1, ME) },
};

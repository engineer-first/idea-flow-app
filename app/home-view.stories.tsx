import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { HomeView } from "@/app/home-view";

const meta = {
  title: "Home/HomeView",
  component: HomeView,
  parameters: { layout: "fullscreen" },
  args: {
    userEmail: "user@example.com",
    createRoomAction: fn(),
    signOutAction: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HomeView>;

export default meta;
type Story = StoryObj<typeof meta>;

// ログイン済みの通常状態（success）。
export const Default: Story = {};

// Server Action 失敗などで ?error= が付いた状態。
export const WithError: Story = {
  args: {
    error: "ルームを作成できませんでした。",
  },
};

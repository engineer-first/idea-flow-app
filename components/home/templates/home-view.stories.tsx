import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HomeView } from "@/components/home/templates/home-view";

const meta = {
  title: "Home/Templates/HomeView",
  component: HomeView,
  parameters: { layout: "fullscreen" },
  args: {},
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

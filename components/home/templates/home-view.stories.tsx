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

// ログイン済みの通常状態（error なし）。
export const Default: Story = {};

// 作成失敗など、query 経由の error。
export const WithCreateError: Story = {
  args: {
    error: "ルームを作成できませんでした。",
  },
};

// 参加失敗。
export const WithJoinError: Story = {
  args: {
    error: "ルームが見つかりませんでした。",
  },
};

// 招待コード形式不正。
export const WithInvalidCodeError: Story = {
  args: {
    error: "招待コードは英数字6桁で入力してください。",
  },
};

// 全状態の一覧（エラー有無のカタログ）。
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-10 p-4">
      {(
        [
          ["Default", undefined],
          ["WithCreateError", "ルームを作成できませんでした。"],
          ["WithJoinError", "ルームが見つかりませんでした。"],
          ["WithInvalidCodeError", "招待コードは英数字6桁で入力してください。"],
        ] as const
      ).map(([label, error]) => (
        <div key={label} className="flex flex-col gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {label}
          </span>
          <div className="min-h-[420px] rounded-lg border border-border">
            <HomeView error={error} />
          </div>
        </div>
      ))}
    </div>
  ),
};

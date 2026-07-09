import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  CreateRoomSectionView,
  type CreateRoomSectionViewProps,
} from "@/components/home/organisms/create-room-section-view";

const meta = {
  title: "Home/Organisms/CreateRoomSection",
  component: CreateRoomSectionView,
  parameters: { layout: "padded" },
  args: {
    pending: false,
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateRoomSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

// 初期状態: 作成ボタンが押せる。
export const Default: Story = {};

// 作成 API 待ち（「作成中…」）。
export const Pending: Story = {
  args: {
    pending: true,
  },
};

// 全状態の一覧。
export const AllStates: Story = {
  render: () => {
    const states: { label: string; props: CreateRoomSectionViewProps }[] = [
      { label: "Default", props: { pending: false, onSubmit: fn() } },
      { label: "Pending", props: { pending: true, onSubmit: fn() } },
    ];
    return (
      <div className="flex w-[360px] flex-col gap-8">
        {states.map(({ label, props }) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {label}
            </span>
            <CreateRoomSectionView {...props} />
          </div>
        ))}
      </div>
    );
  },
};

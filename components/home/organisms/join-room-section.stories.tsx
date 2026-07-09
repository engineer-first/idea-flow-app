import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  JoinRoomSectionView,
  type JoinRoomSectionViewProps,
} from "@/components/home/organisms/join-room-section-view";

const baseArgs: JoinRoomSectionViewProps = {
  code: "",
  onCodeChange: fn(),
  lookingUp: false,
  joining: false,
  dialogOpen: false,
  onDialogOpenChange: fn(),
  hostName: "",
  onSubmit: fn((event: React.FormEvent) => {
    event.preventDefault();
  }),
  onConfirm: fn(),
};

const meta = {
  title: "Home/Organisms/JoinRoomSection",
  component: JoinRoomSectionView,
  parameters: { layout: "padded" },
  args: baseArgs,
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JoinRoomSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

// 未入力: 「参加する」は disabled。
export const Empty: Story = {
  args: {
    code: "",
  },
};

// 途中入力（6 桁未満）: まだ disabled。
export const IncompleteCode: Story = {
  args: {
    code: "AB12",
  },
};

// 6 桁入力済み: 「参加する」が enabled。
export const ValidCode: Story = {
  args: {
    code: "AB12CD",
  },
};

// lookup 中（「確認中…」）。
export const LookingUp: Story = {
  args: {
    code: "AB12CD",
    lookingUp: true,
  },
};

// 確認 Dialog 表示中（ホスト名あり）。
export const ConfirmDialog: Story = {
  args: {
    code: "AB12CD",
    hostName: "田中太郎",
    dialogOpen: true,
  },
};

// 確認 Dialog（ホスト名なしのフォールバック）。
export const ConfirmDialogWithoutHost: Story = {
  args: {
    code: "AB12CD",
    hostName: "",
    dialogOpen: true,
  },
};

// 参加 API 待ち（Dialog 内「参加中…」）。
export const Joining: Story = {
  args: {
    code: "AB12CD",
    hostName: "田中太郎",
    dialogOpen: true,
    joining: true,
  },
};

// 全状態の一覧（フォーム側。Dialog は個別 story で確認）。
export const AllStates: Story = {
  render: () => {
    const states: { label: string; props: JoinRoomSectionViewProps }[] = [
      { label: "Empty", props: { ...baseArgs, code: "" } },
      { label: "IncompleteCode", props: { ...baseArgs, code: "AB12" } },
      { label: "ValidCode", props: { ...baseArgs, code: "AB12CD" } },
      {
        label: "LookingUp",
        props: { ...baseArgs, code: "AB12CD", lookingUp: true },
      },
    ];
    return (
      <div className="flex w-[360px] flex-col gap-8">
        {states.map(({ label, props }) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {label}
            </span>
            <JoinRoomSectionView {...props} />
          </div>
        ))}
      </div>
    );
  },
};

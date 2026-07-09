import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ROOM_MEMBERS_MAX_VISIBLE,
  RoomMembers,
} from "@/app/rooms/[id]/room-members";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";

const ME = "11111111-1111-4111-8111-111111111111";

const meta = {
  title: "Rooms/RoomMembers",
  component: RoomMembers,
  parameters: { layout: "padded" },
  args: {
    members: buildMembers(3, ME),
    currentUserId: ME,
    hostUserId: ME,
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 24, maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomMembers>;

export default meta;
type Story = StoryObj<typeof meta>;

// 3 人・ホスト表示あり。
export const Default: Story = {};

// 自分だけ。
export const OnlyMe: Story = {
  args: { members: buildMembers(1, ME) },
};

// 空（グループ枠のみ）。
export const Empty: Story = {
  args: { members: [] },
};

// 2 列が効く人数。
export const TwoColumns: Story = {
  args: { members: buildMembers(6, ME) },
};

// 上限ちょうど 8 人（+N なし）。
export const FullVisible: Story = {
  args: { members: buildMembers(ROOM_MEMBERS_MAX_VISIBLE, ME) },
};

// 9 人以上で +N（クリックで Dialog）。
export const WithOverflow: Story = {
  args: { members: buildMembers(ROOM_MEMBERS_MAX_VISIBLE + 3, ME) },
};

// 非ホスト視点（自分以外がホスト）。
export const NonHostView: Story = {
  args: {
    members: buildMembers(4, ME),
    hostUserId: buildMembers(4, ME).find((m) => m.userId !== ME)?.userId ?? ME,
  },
};

// 全状態の一覧。
export const AllStates: Story = {
  render: () => {
    const states = [
      { label: "Empty", members: buildMembers(0, ME) },
      { label: "OnlyMe", members: buildMembers(1, ME) },
      { label: "Default", members: buildMembers(3, ME) },
      { label: "TwoColumns", members: buildMembers(6, ME) },
      {
        label: "FullVisible",
        members: buildMembers(ROOM_MEMBERS_MAX_VISIBLE, ME),
      },
      {
        label: "WithOverflow",
        members: buildMembers(ROOM_MEMBERS_MAX_VISIBLE + 3, ME),
      },
    ] as const;
    return (
      <div className="flex max-w-md flex-col gap-8">
        {states.map(({ label, members }) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {label}（{members.length} 名）
            </span>
            <RoomMembers members={members} currentUserId={ME} hostUserId={ME} />
          </div>
        ))}
      </div>
    );
  },
};

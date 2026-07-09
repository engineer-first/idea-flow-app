import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RoomMembers } from "@/app/rooms/[id]/room-members";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";

const ME = "11111111-1111-4111-8111-111111111111";

const meta = {
  title: "Rooms/RoomMembers",
  component: RoomMembers,
  parameters: { layout: "centered" },
  args: {
    members: buildMembers(3, ME),
    currentUserId: ME,
    hostUserId: ME,
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomMembers>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnlyMe: Story = {
  args: { members: buildMembers(1, ME) },
};

export const TwoColumns: Story = {
  args: { members: buildMembers(6, ME) },
};

export const ManyWithHidden: Story = {
  // 既定 maxVisible=8 を超えると +N
  args: { members: buildMembers(11, ME) },
};

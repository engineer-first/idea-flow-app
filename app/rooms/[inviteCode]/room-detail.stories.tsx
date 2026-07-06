import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RoomDetail } from "@/app/rooms/[inviteCode]/room-detail";

const meta = {
  title: "Rooms/RoomDetail",
  component: RoomDetail,
  args: {
    inviteUrl: "http://localhost:3000/invite/example-code",
    inviteExpiresAt: "2026-07-07T10:00:00.000Z",
    userEmail: "owner@example.test",
  },
} satisfies Meta<typeof RoomDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Host: Story = {
  args: {
    memberRole: "host",
  },
};

export const Participant: Story = {
  args: {
    memberRole: "participant",
    userEmail: "member@example.test",
  },
};

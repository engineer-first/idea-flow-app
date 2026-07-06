import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CopyInviteButton } from "@/app/rooms/[inviteCode]/copy-invite-button";

const meta = {
  title: "Rooms/CopyInviteButton",
  component: CopyInviteButton,
  args: {
    inviteUrl: "http://localhost:3000/invite/example-code",
  },
} satisfies Meta<typeof CopyInviteButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

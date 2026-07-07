import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CopyInviteButton } from "@/app/rooms/[id]/copy-invite-button";

const meta = {
  title: "Rooms/CopyInviteButton",
  component: CopyInviteButton,
  parameters: {
    layout: "centered",
  },
  args: {
    url: "https://idea-flow.example/invite/ABC234",
  },
} satisfies Meta<typeof CopyInviteButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

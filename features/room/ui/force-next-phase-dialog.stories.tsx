import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ForceNextPhaseDialog } from "./force-next-phase-dialog";

const meta = {
  title: "Room/ForceNextPhaseDialog",
  component: ForceNextPhaseDialog,
  parameters: {
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof ForceNextPhaseDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = {
  args: {
    open: false,
  },
};

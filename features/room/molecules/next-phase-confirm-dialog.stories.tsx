import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import { NextPhaseConfirmDialog } from "./next-phase-confirm-dialog";

const meta = {
  title: "Room/NextPhaseConfirmDialog",
  component: NextPhaseConfirmDialog,
  args: {
    phase: { kind: "step", phase: 1, step: 1 },
    disabled: false,
    onConfirm: fn(),
  },
} satisfies Meta<typeof NextPhaseConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// トリガーボタンだけが見えている状態。
export const Default: Story = {};

// 未接続・移行処理中・最終フェーズでは操作できない。
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

// 押下後、確認ダイアログが開いた状態（現在フェーズのラベルが説明に入る）。
export const Opened: Story = {
  args: {
    phase: { kind: "step", phase: 1, step: 3 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "次のステップへ" }),
    );
  },
};

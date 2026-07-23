import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { buildCarryover } from "@/contracts/room-protocol.fixture";
import { HmwDecidedIssueBanner } from "./hmw-decided-issue-banner";
import { LONG_DECIDED_ISSUE } from "./hmw-decided-issue-banner.fixture";

const meta = {
  title: "Hmw/HmwDecidedIssueBanner",
  component: HmwDecidedIssueBanner,
  args: {
    content: buildCarryover().content,
  },
} satisfies Meta<typeof HmwDecidedIssueBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// 長文が1行に truncate され、全文は title 属性で読めることを確認する。
// 幅を絞らないと truncate が発動しないため className で制限する。
export const LongContent: Story = {
  args: {
    content: LONG_DECIDED_ISSUE,
    className: "max-w-sm",
  },
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const meta = {
  title: "UI/Tooltip",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ padding: 48 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">ホバーしてください</Button>
        </TooltipTrigger>
        <TooltipContent>ツールチップのテキスト</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const LongText: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">長いテキスト</Button>
        </TooltipTrigger>
        <TooltipContent>
          ツールチップの中に複数行のテキストを入れられます。
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

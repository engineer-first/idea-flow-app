import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const meta = {
  title: "UI/Card",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ padding: 24, width: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>タイトル</CardTitle>
        <CardDescription>説明文が入ります</CardDescription>
      </CardHeader>
      <CardContent>
        <p>本文がここに入ります。</p>
      </CardContent>
      <CardFooter>
        <Button>保存</Button>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card>
      <CardContent className="p-6">
        <p>シンプルな Card</p>
      </CardContent>
    </Card>
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "ボタン",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const variants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;

const sizes = ["xs", "sm", "default", "lg"] as const;

// VRT（Chromatic）ではストーリー数がスナップショット数になるため、
// 全 variant × size を 1 枚のグリッドにまとめて差分検出の対象にする
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      {variants.map((variant) => (
        <div key={variant} className="flex items-center gap-2">
          <span className="w-24 font-mono text-muted-foreground text-xs">
            {variant}
          </span>
          {sizes.map((size) => (
            <Button key={size} variant={variant} size={size}>
              ボタン
            </Button>
          ))}
          <Button variant={variant} disabled>
            無効
          </Button>
        </div>
      ))}
    </div>
  ),
};

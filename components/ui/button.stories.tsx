import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";

import { Button } from "./button";

// shadcn/ui Button のカタログ story（恒久的に維持する。セットアップ用の仮 story ではない）。
// Button はデザイントークン（globals.css）と CVA variant をほぼすべて通過するため、
// トークンや Tailwind の変更による意図しない見た目の退行を VRT で検出する観測点を兼ねる。

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

const textSizes = ["xs", "sm", "default", "lg"] as const;

const iconSizes = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

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
          {textSizes.map((size) => (
            <Button key={size} variant={variant} size={size}>
              ボタン
            </Button>
          ))}
          {iconSizes.map((size) => (
            <Button key={size} variant={variant} size={size} aria-label="追加">
              <Plus />
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

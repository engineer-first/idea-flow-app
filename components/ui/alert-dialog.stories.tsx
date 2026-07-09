import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

const meta = {
  title: "UI/AlertDialog",
  component: AlertDialog,
} satisfies Meta<typeof AlertDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

// shadcn/ui AlertDialog の恒久的な検証用 story。
// AlertDialog は Radix の状態管理を含むため、
// 複数状態を1 storyにまとめて VRT のスナップショット数を抑える。

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      {/* 通常 */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
          >
            Default
          </button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除しますか？</AlertDialogTitle>

            <AlertDialogDescription>
              この操作は取り消すことができません。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>

            <AlertDialogAction>削除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mediaあり */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="rounded-md border px-3 py-2">
            With Media
          </button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangle />
            </AlertDialogMedia>

            <AlertDialogTitle>注意してください</AlertDialogTitle>

            <AlertDialogDescription>
              重要な変更を実行します。 続行すると元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>

            <AlertDialogAction>続行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Small */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="rounded-md border px-3 py-2">
            Small
          </button>
        </AlertDialogTrigger>

        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>短い確認</AlertDialogTitle>

            <AlertDialogDescription>
              簡単な確認ダイアログです。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>

            <AlertDialogAction size="sm">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ),
};

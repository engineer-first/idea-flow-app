import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const meta = {
  title: "UI/Dialog",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// 汎用 Dialog
export const Basic: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">開く</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>操作の確認</DialogTitle>
          <DialogDescription>
            この操作は取り消せません。続行しますか?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">キャンセル</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>続行する</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// 確認 AlertDialog（start_phase の代わりに使う想定）
export const Confirm: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>開始する</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>開始しますか?</AlertDialogTitle>
          <AlertDialogDescription>
            一度開始すると全員がボードに移動します。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={fn()}>開始する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

// 制御付きの Dialog（開閉 state を外側で管理）
export const Controlled: Story = {
  render: function ControlledRender() {
    const [open, setOpen] = useState(false);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">制御付きで開く</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>制御付き</DialogTitle>
            <DialogDescription>
              onOpenChange で開閉を制御できます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
};

"use client";

// 退出 / 解散の確認 Dialog。ボード画面とスタート画面の両方で使う。
// ホストは「ルームを解散」、参加者は「退出」の文言になる。
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/dialog";

export type LeaveConfirmMode = "leave" | "disband";

export type LeaveConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLeaving: boolean;
  // ホストは disband、それ以外は leave（既定）。
  mode?: LeaveConfirmMode;
};

const COPY: Record<
  LeaveConfirmMode,
  {
    title: string;
    description: string;
    confirm: string;
    confirming: string;
  }
> = {
  leave: {
    title: "退出しますか？",
    description:
      "退出すると、このルームに戻るには招待URLから再度参加する必要があります。",
    confirm: "退出する",
    confirming: "退出中…",
  },
  disband: {
    title: "ルームを解散しますか？",
    description:
      "解散するとルームは削除され、参加中のメンバーは全員退出になります。招待URLも使えなくなります。",
    confirm: "ルームを解散",
    confirming: "解散中…",
  },
};

export function LeaveConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLeaving,
  mode = "leave",
}: LeaveConfirmDialogProps) {
  const copy = COPY[mode];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLeaving}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={isLeaving}
            data-testid="leave-confirm-action"
          >
            {isLeaving ? copy.confirming : copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

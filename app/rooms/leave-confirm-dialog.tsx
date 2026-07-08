"use client";

// 退出確認 Dialog。ボード画面とスタート画面の両方で使う。
// 「退出する」ボタンを押すと confirm 用の AlertDialog を表示し、
// 確定で `onConfirm` を呼ぶ。
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

export type LeaveConfirmDialogProps = {
  // true のとき Dialog を開く（親が isLeaving や state で制御する想定）
  open: boolean;
  // Dialog の開閉状態が変わったとき（Cancel や Overlay クリックで閉じる）
  onOpenChange: (open: boolean) => void;
  // 確定ボタンが押されたとき
  onConfirm: () => void;
  // 処理中のとき「退出する」ボタンを disabled にする
  isLeaving: boolean;
};

export function LeaveConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLeaving,
}: LeaveConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>退出しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            退出すると、このルームに戻るには招待URLから再度参加する必要があります。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLeaving}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // ブラウザの遷移を待たずに Container の処理で leaveRoom を走らせる
              event.preventDefault();
              onConfirm();
            }}
            disabled={isLeaving}
            data-testid="leave-confirm-action"
          >
            {isLeaving ? "退出中…" : "退出する"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

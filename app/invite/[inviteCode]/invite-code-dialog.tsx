"use client";

// 招待URL (/invite/[code]) で開かれる確認画面。
// 招待コードを Dialog で表示し、確定で joinRoom Server Action を呼ぶ。
// 既存 route.ts の「招待 URL を開いたら join する」挙動を、確認 Dialog を
// 介する UX に置き換える（#70 の入室 Dialog 化の対象）。
// hostName が解決できたときは「hostname さんが作成したルームに参加しますか？」
// と表示し、できなかったときは招待コードのみ表示する。
import { useEffect, useState, useTransition } from "react";
import { joinRoom } from "@/app/rooms/actions";
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

export type InviteCodeDialogProps = {
  inviteCode: string;
  hostName?: string | null;
};

export function InviteCodeDialog({
  inviteCode,
  hostName,
}: InviteCodeDialogProps) {
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  // SSR で描画された直後に user が Dialog を見て「参加する」を押せるよう、
  // initial は open。Esc やオーバーレイクリックで閉じた場合は / へ戻す。
  useEffect(() => {
    if (!open) {
      // キャンセルや Esc で閉じた場合はホームへ
      window.location.href = "/home";
    }
  }, [open]);

  function handleConfirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("code", inviteCode);
      try {
        await joinRoom(formData);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          typeof (error as { digest?: unknown }).digest === "string" &&
          (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          return;
        }
        throw error;
      }
    });
  }

  // hostName が見つかれば「hostname さんが作成したルームに参加しますか？」、
  // 見つからなければ従来の「招待コード XXX のルームに参加しますか？」。
  const title = hostName
    ? `${hostName} さんが作成したルームに参加しますか？`
    : "このルームに参加しますか？";
  const description = (
    <>
      招待コード <span className="font-mono font-semibold">{inviteCode}</span>{" "}
      のルームに参加します。
    </>
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent data-testid="invite-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
            disabled={pending}
            data-testid="invite-join-action"
          >
            {pending ? "参加中…" : "参加する"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

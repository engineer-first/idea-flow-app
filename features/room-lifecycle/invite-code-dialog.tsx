"use client";

// 招待URL (/invite/[code]) で開かれる確認画面。
// 招待コードを Dialog で表示し、確定で joinRoom Server Action を呼ぶ。
// 成功時は toast → スタート画面へ遷移（ホーム参加・作成と同じ経路）。
// hostName は page 側の lookup 成功後に必ず渡る。
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import { notify } from "@/lib/notify";
import { joinRoom } from "./actions";
import { lifecycleNotify } from "./lifecycle-notify";

export type InviteCodeDialogProps = {
  inviteCode: string;
  hostName: string;
};

export function InviteCodeDialog({
  inviteCode,
  hostName,
}: InviteCodeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  // SSR で描画された直後に user が Dialog を見て「参加する」を押せるよう、
  // initial は open。Esc やオーバーレイクリックで閉じた場合は /home へ戻す。
  useEffect(() => {
    if (!open) {
      window.location.href = "/home";
    }
  }, [open]);

  function handleConfirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("code", inviteCode);
      const result = await joinRoom(formData);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      lifecycleNotify.joinedAsGuest();
      // open を false にすると useEffect が /home へ飛ばすため、成功時は開いたまま遷移する。
      router.push(`/rooms/${result.roomId}/start`);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent data-testid="invite-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hostName} さんが作成したルームに参加しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            招待コード{" "}
            <span className="font-mono font-semibold">{inviteCode}</span>{" "}
            のルームに参加します。
          </AlertDialogDescription>
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

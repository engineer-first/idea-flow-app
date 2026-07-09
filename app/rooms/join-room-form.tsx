"use client";

// ホーム画面の「招待コードで参加」フォーム。
// 招待コードを入力 → lookup でホスト名を解決 → 確認 Dialog → joinRoom。
// 成功時は toast → スタート画面へ遷移（作成と同じ経路）。
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { notify } from "@/app/_lib/notify";
import { joinRoom, lookupInviteRoom } from "@/app/rooms/actions";
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
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [hostName, setHostName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lookingUp, startLookup] = useTransition();
  const [joining, startJoin] = useTransition();

  // 6 桁英数字のみを許可。生成時の曖昧文字（0/O, 1/I）は除外されているが、
  // 入力側は「過去に発行されたコード」を受け入れられるよう英数字全体を許容する
  // （contracts/invite-code.ts の INVITE_CODE_PATTERN と合わせる）。
  const isValidCode = /^[A-Z0-9]{6}$/.test(code);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidCode) return;
    startLookup(async () => {
      const result = await lookupInviteRoom(code);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setHostName(result.hostName);
      setDialogOpen(true);
    });
  }

  function handleConfirm() {
    if (!isValidCode) return;
    startJoin(async () => {
      const formData = new FormData();
      formData.append("code", code);
      const result = await joinRoom(formData);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.joinedAsGuest();
      setDialogOpen(false);
      router.push(`/rooms/${result.roomId}/start`);
    });
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
        data-testid="join-room-form"
      >
        <Field>
          <FieldLabel htmlFor="code">招待コード</FieldLabel>
          <Input
            id="code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={6}
            placeholder="AB12CD"
            autoComplete="off"
            required
            className="font-mono"
          />
          <FieldDescription>6 桁の英数字</FieldDescription>
        </Field>
        <Button
          type="submit"
          disabled={!isValidCode || lookingUp}
          className="w-full"
        >
          {lookingUp ? "確認中…" : "参加する"}
        </Button>
      </form>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hostName} さんが作成したルームに参加しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              招待コード <span className="font-mono font-semibold">{code}</span>{" "}
              のルームに参加します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={joining}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirm();
              }}
              disabled={joining}
              data-testid="join-confirm-action"
            >
              {joining ? "参加中…" : "参加する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

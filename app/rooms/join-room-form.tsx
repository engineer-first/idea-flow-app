"use client";

// ホーム画面の「招待コードで参加」フォーム。
// 招待コードを入力 → 確認 Dialog で誤入力防止 → 確定で joinRoom Server Action 実行。
// #70 の入室 Dialog 化の対象。
import { useState, useTransition } from "react";
import { joinRoom } from "@/app/rooms/actions";
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
  const [code, setCode] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // 6 桁英数字のみを許可。生成時の曖昧文字（0/O, 1/I）は除外されているが、
  // 入力側は「過去に発行されたコード」を受け入れられるよう英数字全体を許容する
  // （contracts/invite-code.ts の INVITE_CODE_PATTERN と合わせる）。
  const isValidCode = /^[A-Z0-9]{6}$/.test(code);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidCode) return;
    setDialogOpen(true);
  }

  function handleConfirm() {
    if (!isValidCode) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.append("code", code);
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
        <Button type="submit" disabled={!isValidCode} className="w-full">
          参加する
        </Button>
      </form>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このルームに参加しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              招待コード <span className="font-mono font-semibold">{code}</span>{" "}
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
              data-testid="join-confirm-action"
            >
              {pending ? "参加中…" : "参加する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

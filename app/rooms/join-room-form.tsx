"use client";

// ホーム画面の「招待コードで参加」フォーム（コンテナ）。
// 招待コードを入力 → lookup でホスト名を解決 → 確認 Dialog → joinRoom。
// 成功時は toast → スタート画面へ遷移（作成と同じ経路）。
// 表示は JoinRoomFormView に委譲する。
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { notify } from "@/app/_lib/notify";
import { joinRoom, lookupInviteRoom } from "@/app/rooms/actions";
import { JoinRoomFormView } from "@/app/rooms/join-room-form-view";

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
    <JoinRoomFormView
      code={code}
      onCodeChange={setCode}
      lookingUp={lookingUp}
      joining={joining}
      dialogOpen={dialogOpen}
      onDialogOpenChange={setDialogOpen}
      hostName={hostName}
      onSubmit={handleSubmit}
      onConfirm={handleConfirm}
    />
  );
}

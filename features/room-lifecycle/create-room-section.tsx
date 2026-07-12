"use client";

// ホーム「ルームを作成」セクション（organism / コンテナ）。
// 作成成功時に toast を出してからスタート画面へ遷移する。
// 表示は CreateRoomSectionView に委譲する。
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { notify } from "@/lib/notify";
import { createRoom } from "./actions";
import { CreateRoomSectionView } from "./create-room-section-view";
import { lifecycleNotify } from "./lifecycle-notify";

export function CreateRoomSection() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createRoom();
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      lifecycleNotify.roomCreated();
      router.push(`/rooms/${result.roomId}/start`);
    });
  }

  return <CreateRoomSectionView pending={pending} onSubmit={handleSubmit} />;
}

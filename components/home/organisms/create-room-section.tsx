"use client";

// ホーム「ルームを作成」セクション（organism）。
// 作成成功時に toast を出してからスタート画面へ遷移する。
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { notify } from "@/app/_lib/notify";
import { createRoom } from "@/app/rooms/actions";
import { Button } from "@/components/ui/button";

export function CreateRoomSection() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createRoom();
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.roomCreated();
      router.push(`/rooms/${result.roomId}/start`);
    });
  }

  return (
    <section className="flex flex-col gap-3" data-testid="home-create-room">
      <h2 className="text-sm font-medium">ルームを作成</h2>
      <form onSubmit={handleSubmit}>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "作成中…" : "ルームを作成"}
        </Button>
      </form>
    </section>
  );
}

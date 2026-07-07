import { notFound, redirect } from "next/navigation";
import { buildInviteUrl } from "@/app/invite/invite-url";
import { RoomBoard } from "@/app/rooms/[id]/room-board";
import { RoomInfoResponseSchema } from "@/contracts/api";
import { isUuid } from "@/contracts/ids";
import { apiFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session/current-user";
import { getBaseUrl } from "@/lib/session/env";

export const dynamic = "force-dynamic";

type RoomPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // メンバーシップは api-worker（の先の RoomDO）が判定する。
  // 非メンバー・存在しないルームはどちらも 404 で返るため、そのまま notFound() へ。
  const res = await apiFetch(`/api/rooms/${id}`);
  if (!res.ok) {
    notFound();
  }

  const parsed = RoomInfoResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    notFound();
  }

  // 招待URL の origin は設定値（NEXT_PUBLIC_SITE_URL、本番では必須）から作る。
  // x-forwarded-host / host はクライアントが偽装できるヘッダーで、Cloudflare も
  // 既定では剥がさない。共有される URL の origin をそこから組み立てない。
  const inviteUrl = buildInviteUrl(getBaseUrl(), parsed.data.inviteCode);

  // key={roomId} で、クライアント遷移（/rooms/A → /rooms/B）時に RoomBoard を
  // 強制的に再マウントする。これがないと notes state（や draggingNoteId）が
  // 旧ルームの値を保持し、新ルームの snapshot が届くまで旧データが表示される。
  return (
    <main className="flex h-screen flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">IdeaFlow ルーム</h1>
      <div className="min-h-0 flex-1">
        <RoomBoard
          key={parsed.data.roomId}
          roomId={parsed.data.roomId}
          inviteCode={parsed.data.inviteCode}
          inviteUrl={inviteUrl}
        />
      </div>
    </main>
  );
}

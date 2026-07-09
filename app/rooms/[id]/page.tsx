import { notFound, redirect } from "next/navigation";
import { buildInviteUrl } from "@/app/invite/invite-url";
import { RoomBoard } from "@/app/rooms/[id]/room-board";
import {
  RoomInfoResponseSchema,
  RoomMembersResponseSchema,
} from "@/contracts/api";
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

  // lobby 状態なら付箋画面に直行させず、スタート画面へ誘導する（#70 仕様）。
  // 既に writing 状態なら、ボードを直接開く。
  if (parsed.data.phase === "lobby") {
    redirect(`/rooms/${parsed.data.roomId}/start`);
  }

  // メンバー一覧を SSR で取得して初回描画時の flicker を抑える。
  // 非 2xx でも不正ボディでも snapshot で復元できるので、フォールバックは空配列。
  const membersRes = await apiFetch(`/api/rooms/${id}/members`);
  const membersParsed = membersRes.ok
    ? RoomMembersResponseSchema.safeParse(
        await membersRes.json().catch(() => null),
      )
    : null;
  const initialMembers = membersParsed?.success
    ? membersParsed.data.members
    : [];

  // 招待URL の origin は設定値（NEXT_PUBLIC_SITE_URL、本番では必須）から作る。
  const inviteUrl = buildInviteUrl(getBaseUrl(), parsed.data.inviteCode);

  // key={roomId} で、クライアント遷移（/rooms/A → /rooms/B）時に RoomBoard を
  // 強制的に再マウントする。これがないと notes state（や draggingNoteId）が
  // 旧ルームの値を保持し、新ルームの snapshot が届くまで旧データが表示される。
  return (
    <main className="flex h-screen flex-col gap-4 p-4">
      <div className="min-h-0 flex-1">
        <RoomBoard
          key={parsed.data.roomId}
          roomId={parsed.data.roomId}
          inviteCode={parsed.data.inviteCode}
          inviteUrl={inviteUrl}
          currentUserId={user.sub}
          isHost={parsed.data.isHost}
          hostUserId={parsed.data.hostUserId}
          initialMembers={initialMembers}
          initialPhase={parsed.data.phase}
        />
      </div>
    </main>
  );
}

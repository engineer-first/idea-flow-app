import { notFound, redirect } from "next/navigation";
import { buildInviteUrl } from "@/app/invite/invite-url";
import { RoomStartBoard } from "@/app/rooms/[id]/start/room-start-board";
import {
  RoomInfoResponseSchema,
  RoomMembersResponseSchema,
} from "@/contracts/api";
import { isUuid } from "@/contracts/ids";
import { apiFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session/current-user";
import { getBaseUrl } from "@/lib/session/env";

export const dynamic = "force-dynamic";

type StartPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StartPage({ params }: StartPageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // セッション必須・メンバー必須（api-worker 側で判定、404 なら notFound）。
  const res = await apiFetch(`/api/rooms/${id}`);
  if (!res.ok) {
    notFound();
  }
  const parsed = RoomInfoResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    notFound();
  }

  // 既に writing ならボードへ直行（スタート画面に留まる意味がない）。
  if (parsed.data.phase === "writing") {
    redirect(`/rooms/${parsed.data.roomId}`);
  }

  // メンバー一覧を SSR で取得（初期表示用）。失敗しても snapshot で復元できる。
  const membersRes = await apiFetch(`/api/rooms/${id}/members`);
  const initialMembers = membersRes.ok
    ? RoomMembersResponseSchema.parse(await membersRes.json()).members
    : [];

  const inviteUrl = buildInviteUrl(getBaseUrl(), parsed.data.inviteCode);

  return (
    <main className="flex h-screen flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold">IdeaFlow ルーム</h1>
      <div className="min-h-0 flex-1">
        <RoomStartBoard
          key={parsed.data.roomId}
          roomId={parsed.data.roomId}
          inviteCode={parsed.data.inviteCode}
          inviteUrl={inviteUrl}
          currentUserId={user.sub}
          isHost={parsed.data.isHost}
          initialPhase={parsed.data.phase}
          initialMembers={initialMembers}
        />
      </div>
    </main>
  );
}

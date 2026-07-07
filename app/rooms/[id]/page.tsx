import { notFound, redirect } from "next/navigation";
import { RoomBoard } from "@/app/rooms/[id]/room-board";
import { RoomInfoResponseSchema } from "@/contracts/api";
import { apiFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session/current-user";

export const dynamic = "force-dynamic";

type RoomPageProps = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
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

  // 付箋の初期データは Phase 3 で WebSocket 接続時のスナップショットに置き換わる。
  return (
    <main className="flex h-screen flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">IdeaFlow ルーム</h1>
      <div className="min-h-0 flex-1">
        <RoomBoard
          roomId={parsed.data.roomId}
          inviteCode={parsed.data.inviteCode}
          initialNotes={[]}
        />
      </div>
    </main>
  );
}

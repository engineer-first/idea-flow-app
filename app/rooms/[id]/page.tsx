import { notFound, redirect } from "next/navigation";
import { RoomBoard } from "@/app/rooms/[id]/room-board";
import { toNote } from "@/app/rooms/notes-reducer";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  // rooms/notes ともにRLSで「メンバーのみSELECT可」を強制しているため、
  // 非メンバーがアクセスした場合はここで0件（またはエラー）になり notFound() へ落ちる。
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, invite_code")
    .eq("id", id)
    .single();

  if (roomError || !room) {
    notFound();
  }

  const { data: noteRows, error: notesError } = await supabase
    .from("notes")
    .select("id, room_id, author_id, content, x, y, created_at, updated_at")
    .eq("room_id", id)
    .order("created_at", { ascending: true });

  if (notesError) {
    notFound();
  }

  const notes = (noteRows ?? []).map(toNote);

  return (
    <main className="flex h-screen flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">IdeaFlow ルーム</h1>
      <div className="min-h-0 flex-1">
        <RoomBoard
          roomId={room.id}
          inviteCode={room.invite_code}
          initialNotes={notes}
        />
      </div>
    </main>
  );
}

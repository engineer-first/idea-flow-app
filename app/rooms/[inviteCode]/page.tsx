import { redirect } from "next/navigation";
import { RoomDetail } from "@/app/rooms/[inviteCode]/room-detail";
import { unwrapRoomQueryResult } from "@/app/rooms/[inviteCode]/room-query-results";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RoomPageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

type RoomRecord = {
  id: number;
  invite_code: string;
  invite_expires_at: string;
};

type RoomMemberRecord = {
  role: "host" | "participant";
};

function getBaseUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (siteUrl) {
    return siteUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
  }

  return "http://localhost:3000";
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { inviteCode } = await params;

  if (!isSupabaseConfigured()) {
    redirect(
      "/login?error=Supabase%E3%81%AE%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0%E3%82%92%E8%A8%AD%E5%AE%9A%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82",
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/rooms/${inviteCode}`)}`);
  }

  const supabase = await createClient();
  const roomResult = await supabase
    .from("rooms")
    .select("id, invite_code, invite_expires_at")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  const room = unwrapRoomQueryResult(
    roomResult as {
      data: RoomRecord | null;
      error: { message: string } | null;
    },
    inviteCode,
  );

  const memberResult = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const member = unwrapRoomQueryResult(
    memberResult as {
      data: RoomMemberRecord | null;
      error: { message: string } | null;
    },
    inviteCode,
  );

  const inviteUrl = `${getBaseUrl()}/invite/${room.invite_code}`;

  return (
    <RoomDetail
      inviteUrl={inviteUrl}
      inviteExpiresAt={room.invite_expires_at}
      memberRole={member.role}
      userEmail={user.email}
    />
  );
}

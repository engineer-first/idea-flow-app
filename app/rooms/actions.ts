"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type CreateRoomResult = {
  invite_code: string;
  invite_expires_at: string;
};

export async function createRoom() {
  if (!isSupabaseConfigured()) {
    redirect(
      "/login?error=Supabase%E3%81%AE%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0%E3%82%92%E8%A8%AD%E5%AE%9A%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .rpc("create_room")
    .single<CreateRoomResult>();

  if (error || !data) {
    throw new Error(error?.message ?? "ルームを作成できませんでした。");
  }

  redirect(`/rooms/${data.invite_code}`);
}

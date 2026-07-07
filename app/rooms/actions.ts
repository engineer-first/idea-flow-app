"use server";

import { redirect } from "next/navigation";
import { getSupabaseConfigurationErrorLoginPath } from "@/app/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type CreateRoomResult = {
  invite_code: string;
  invite_expires_at: string;
};

export async function createRoom() {
  if (!isSupabaseConfigured()) {
    redirect(getSupabaseConfigurationErrorLoginPath());
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

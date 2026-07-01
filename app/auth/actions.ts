"use server";

import { redirect } from "next/navigation";
import { isDevAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

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

export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    loginError("Supabaseの環境変数を設定してください。");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getBaseUrl()}/auth/callback`,
    },
  });
  const url = data.url;

  if (error || !url) {
    loginError(error?.message ?? "Googleログインを開始できませんでした。");
  }

  redirect(url);
}

export async function signInWithPassword(formData: FormData) {
  if (!isDevAuthEnabled()) {
    loginError("開発用ログインは無効です。");
  }

  if (!isSupabaseConfigured()) {
    loginError("Supabaseの環境変数を設定してください。");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginError(error.message);
  }

  redirect("/");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

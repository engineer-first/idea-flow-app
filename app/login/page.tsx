import { redirect } from "next/navigation";
import { signInWithGoogle, signInWithPassword } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isDevAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import LoginCard from "./login-card";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await getCurrentUser()) redirect("/");

  return (
    <LoginCard
      error={error}
      isConfigured={isSupabaseConfigured()}
      showDevAuth={isDevAuthEnabled()}
      googleAction={signInWithGoogle}
      passwordAction={signInWithPassword}
    />
  );
}

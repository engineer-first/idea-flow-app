import { redirect } from "next/navigation";
import { signInWithDevPassword, signInWithGoogle } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/session/current-user";
import { isAuthConfigured, isDevAuthEnabled } from "@/lib/session/env";
import LoginCard from "./login-card";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <LoginCard
      error={error}
      isConfigured={isAuthConfigured()}
      showDevAuth={isDevAuthEnabled()}
      googleAction={signInWithGoogle}
      passwordAction={signInWithDevPassword}
    />
  );
}

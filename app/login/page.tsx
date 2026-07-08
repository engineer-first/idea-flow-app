import { redirect } from "next/navigation";
import { signInWithDevPassword, signInWithGoogle } from "@/app/auth/actions";
import { sanitizeNextPath } from "@/app/auth/redirects";
import { getCurrentUser } from "@/lib/session/current-user";
import { isAuthConfigured, isDevAuthEnabled } from "@/lib/session/env";
import LoginCard from "./login-card";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  if (await getCurrentUser()) {
    // 既にログイン済みなら戻り先（招待URL 等）へ直行する。
    redirect(sanitizeNextPath(next));
  }

  // next を各アクションに束縛して渡す（LoginCard の API は変えない）。
  const safeNext = sanitizeNextPath(next);

  return (
    <LoginCard
      error={error}
      isConfigured={isAuthConfigured()}
      showDevAuth={isDevAuthEnabled()}
      googleAction={signInWithGoogle.bind(null, safeNext)}
      passwordAction={signInWithDevPassword.bind(null, safeNext)}
    />
  );
}

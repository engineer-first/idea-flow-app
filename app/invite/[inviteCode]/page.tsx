import { redirect } from "next/navigation";
import { getLoginPath, sanitizeNextPath } from "@/app/auth/redirects";
import { InviteCodeDialog } from "@/app/invite/[inviteCode]/invite-code-dialog";
import { getCurrentUser } from "@/lib/session/current-user";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ inviteCode: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { inviteCode: raw } = await params;
  const invitePath = `/invite/${raw}`;
  const user = await getCurrentUser();

  // 未ログインは /login へ（戻り先 = 招待URL）。既存の route.ts と同じ挙動。
  if (!user) {
    redirect(getLoginPath(sanitizeNextPath(invitePath)));
  }

  // InviteCodeDialog が client component。
  // Dialog は defaultOpen=true で開き、確定で joinRoom Server Action を呼ぶ。
  return <InviteCodeDialog inviteCode={raw} />;
}

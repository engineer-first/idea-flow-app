import { redirect } from "next/navigation";
import { getLoginPath, sanitizeNextPath } from "@/app/auth/redirects";
import { InviteCodeDialog } from "@/app/invite/[inviteCode]/invite-code-dialog";
import { lookupRoomByInviteCode } from "@/lib/api-client";
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

  // 招待コードから hostname を取得（Dialog の文言に使う）。
  // 失敗時は null のまま、Dialog 側で汎用文言にフォールバック。
  const lookup = await lookupRoomByInviteCode(raw).catch(() => null);
  const hostName = lookup?.hostName ?? null;

  return <InviteCodeDialog inviteCode={raw} hostName={hostName} />;
}

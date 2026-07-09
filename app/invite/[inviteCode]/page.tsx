import { redirect } from "next/navigation";
import { getLoginPath, sanitizeNextPath } from "@/app/auth/redirects";
import { InviteCodeDialog } from "@/app/invite/[inviteCode]/invite-code-dialog";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/contracts/invite-code";
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

  // 未ログインは /login へ（戻り先 = 招待URL）。
  if (!user) {
    redirect(getLoginPath(sanitizeNextPath(invitePath)));
  }

  const code = normalizeInviteCode(raw);
  if (!isValidInviteCode(code)) {
    redirect(
      `/home?error=${encodeURIComponent("招待コードは英数字6桁で入力してください。")}`,
    );
  }

  // 存在しない・無効な招待は参加 Dialog を出さずホームへ（エラー表示）。
  const lookup = await lookupRoomByInviteCode(code);
  if (!lookup) {
    redirect(
      `/home?error=${encodeURIComponent("ルームが見つかりませんでした。")}`,
    );
  }

  return (
    <InviteCodeDialog
      inviteCode={lookup.inviteCode}
      hostName={lookup.hostName}
    />
  );
}

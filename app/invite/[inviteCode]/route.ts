// 招待URL のエントリ。/invite/[code] を開くと、ログイン状態に応じて:
//   - 未ログイン → /login?next=/invite/[code]（ログイン後にここへ戻る）
//   - ログイン済 → api-worker で参加 → /rooms/[roomId] へ遷移
//   - コードが無効 → /invite/[code]/invalid
// ルームの正規URLは UUID の /rooms/[id]。招待コードは参加の手段にすぎない。
import { type NextRequest, NextResponse } from "next/server";
import { getLoginPath } from "@/app/auth/redirects";
import { buildInvitePath } from "@/app/invite/invite-url";
import { JoinRoomResponseSchema } from "@/contracts/api";
import { normalizeInviteCode } from "@/contracts/invite-code";
import { apiFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session/current-user";

export const dynamic = "force-dynamic";

type InviteRouteContext = {
  params: Promise<{ inviteCode: string }>;
};

export async function GET(
  request: NextRequest,
  context: InviteRouteContext,
): Promise<NextResponse> {
  const { inviteCode } = await context.params;
  const invitePath = buildInvitePath(inviteCode);

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(getLoginPath(invitePath), request.url),
    );
  }

  const res = await apiFetch("/api/rooms/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: normalizeInviteCode(inviteCode) }),
  });

  if (!res.ok) {
    // 404（無効なコード）も 400（形式不正）も、利用者にはどちらも「無効な招待」。
    return NextResponse.redirect(new URL(`${invitePath}/invalid`, request.url));
  }

  const parsed = JoinRoomResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    return NextResponse.redirect(new URL(`${invitePath}/invalid`, request.url));
  }

  return NextResponse.redirect(
    new URL(`/rooms/${parsed.data.roomId}`, request.url),
  );
}

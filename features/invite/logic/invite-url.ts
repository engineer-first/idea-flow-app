// 招待URL/パスの組み立て。ルームの正規URLは /rooms/[uuid] のままにし、
// /invite/[code] を参加エントリ（訪問すると参加してルームへ遷移）にする。
export function buildInvitePath(inviteCode: string): string {
  return `/invite/${encodeURIComponent(inviteCode)}`;
}

export function buildInviteUrl(origin: string, inviteCode: string): string {
  return new URL(buildInvitePath(inviteCode), origin).toString();
}

type InviteError = {
  code?: string | null;
};

export function isInvalidOrExpiredInviteError(error: InviteError | null) {
  return error?.code === "IF001" || error?.code === "IF002";
}

export function getInviteFailureRedirectPath(
  inviteCode: string,
  error: InviteError | null,
) {
  if (isInvalidOrExpiredInviteError(error)) {
    return `/invite/${encodeURIComponent(inviteCode)}/expired`;
  }

  return "/";
}

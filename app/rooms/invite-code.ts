// 招待コードは DB 側で英大文字+数字6桁（曖昧になりやすい 0/O, 1/I を除く）として
// 発行される。クライアント側では「大文字化・空白除去」までは寛容に補正し、
// その後の形式チェックは厳格な正規表現で行う。曖昧文字を許容するかは
// generate_invite_code() 側のアルファベットで決まるため、ここでは
// 英数字6桁という形式のみを検証する。
const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function normalizeInviteCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidInviteCode(code: string): boolean {
  return INVITE_CODE_PATTERN.test(code);
}

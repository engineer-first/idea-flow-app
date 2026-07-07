// 招待コード生成。Supabase 時代の internal.generate_invite_code() から移植。
// 誤読しやすい 0/O, 1/I を除いた32文字から6文字を選ぶ。
// 乱数源は引数で注入できる（テストの決定性のため）。
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const index = Math.floor(random() * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[index];
  }
  return code;
}

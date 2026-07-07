// 招待コード生成。Supabase 時代の internal.generate_invite_code() から移植。
// 誤読しやすい 0/O, 1/I を除いた32文字から6文字を選ぶ。
// 招待コードはルーム参加を許可する事実上のベアラートークンなので、
// 既定の乱数源は予測可能な Math.random ではなく CSPRNG を使う。
// 乱数源は引数で注入できる（テストの決定性のため）。
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_LENGTH = 6;

// [0, 1) の一様乱数を CSPRNG から得る。アルファベットが 32 文字 = 2^5 で
// 2^32 を割り切るため、この変換で剰余バイアスは生じない。
function cryptoRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) / 2 ** 32;
}

export function generateInviteCode(
  random: () => number = cryptoRandom,
): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const index = Math.floor(random() * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[index];
  }
  return code;
}

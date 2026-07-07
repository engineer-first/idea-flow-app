// 招待コード（招待URL・招待コード入力の両方で使う共有ロジック）。
// 生成は api-worker の insertRoom（workers/lib/db.ts）が担う。生成された
// コードは事実上のベアラートークン（このコードを知っていればルームに参加できる）
// なので、既定の乱数源には予測可能な Math.random ではなく CSPRNG を使う。
// 検証（normalizeInviteCode / isValidInviteCode）はクライアント・サーバー双方の
// 入力境界で使うため、コントラクト層に置く。

// 誤読しやすい 0/O, 1/I を除いた32文字から6文字を選んで生成する。
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_LENGTH = 6;

// [0, 1) の一様乱数を CSPRNG から得る。アルファベットが 32 文字 = 2^5 で
// 2^32 を割り切るため、この変換で剰余バイアスは生じない。
function cryptoRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) / 2 ** 32;
}

// 乱数源は引数で注入できる（テストの決定性のため）。
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

// 入力側の検証は、生成アルファベット（曖昧文字を除いた32文字）より寛容な
// 「英大文字+数字6桁」を受け入れる。生成側のアルファベットが将来変わっても
// 過去に発行済みのコードや、利用者が手入力した際の許容範囲を狭めすぎないため。
// 正規化（大文字化・空白除去）まではここで寛容に補正し、その後の形式チェックは
// 厳格な正規表現で行う。
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

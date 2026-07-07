// URL パスパラメータ等に現れる ID の形式判定。
// ルーム ID は crypto.randomUUID() で発行される UUID。ルート側はまずこの形式で
// 弾いてから D1 / RoomDO へ問い合わせる（存在しない ID 形式で後段に到達させない）。
// zod の z.string().uuid() ではなく正規表現を共有するのは、受理範囲を
// この形（8-4-4-4-12 の16進、大文字小文字不問）に固定し、ライブラリ側の
// バージョンアップで判定が変わらないようにするため。
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

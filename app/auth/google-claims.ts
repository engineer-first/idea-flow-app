// Google id_token クレームの判定ヘルパー。
// email_verified はクレーム欠落時も「未検証」とみなす（fail-closed）。
// api-worker 側の upsert（workers/lib/db.ts）は email で既存アカウントへ
// リンクするため、未検証メールを通すと他人のアカウントへ合流できてしまう。
export function isEmailVerified(claims: { email_verified?: boolean }): boolean {
  return claims.email_verified === true;
}

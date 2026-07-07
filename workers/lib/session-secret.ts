// SESSION_SECRET のフェイルファスト検証。
// Cloudflare の vars は `wrangler secret put` で上書きしない限り本番へ適用される。
// 秘密を vars にコミットして「気づかず本番で有効」になる事故を防ぐため、
// 秘密は vars に置かず、未設定・短すぎ・既知漏洩値なら起動時に例外で落とす。
// これにより「設定漏れ」がサイレントに既知鍵で動くのではなく、明示的に失敗する。

// 開発の初期に wrangler.jsonc の vars へ平文コミットしてしまい、
// git 履歴に永久に残った値。本番で誤って再利用されないよう拒否する。
export const KNOWN_INSECURE_SECRETS: readonly string[] = [
  "dev-session-secret-change-in-production!!",
];

const MIN_SECRET_LENGTH = 16;

export function requireSessionSecret(secret: string | undefined): string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "SESSION_SECRET が未設定または短すぎます。本番では `wrangler secret put SESSION_SECRET` で十分な長さの秘密を設定してください。",
    );
  }
  if (KNOWN_INSECURE_SECRETS.includes(secret)) {
    throw new Error(
      "SESSION_SECRET が git 履歴に漏れた既知の値です。新しい秘密を生成し `wrangler secret put SESSION_SECRET` で設定してください。",
    );
  }
  return secret;
}

// SESSION_SECRET のフェイルファスト検証（workers 側）。
// Cloudflare の vars は `wrangler secret put` で上書きしない限り本番へ適用される。
// 秘密を vars にコミットして「気づかず本番で有効」になる事故を防ぐため、
// 秘密は vars に置かず、未設定・短すぎ・既知漏洩値なら起動時に例外で落とす。
// これにより「設定漏れ」がサイレントに既知鍵で動くのではなく、明示的に失敗する。
// 妥当性判定そのものは lib/session/secret.ts に一点集約されている。
import { sessionSecretIssue } from "../../lib/session/secret";

export function requireSessionSecret(secret: string | undefined): string {
  const issue = sessionSecretIssue(secret);
  if (issue === "missing-or-short" || secret === undefined) {
    throw new Error(
      "SESSION_SECRET が未設定または短すぎます。本番では `wrangler secret put SESSION_SECRET` で 32 バイト以上の秘密を設定してください。",
    );
  }
  if (issue === "known-insecure") {
    throw new Error(
      "SESSION_SECRET が git 履歴に漏れた既知の値です。新しい秘密を生成し `wrangler secret put SESSION_SECRET` で設定してください。",
    );
  }
  return secret;
}

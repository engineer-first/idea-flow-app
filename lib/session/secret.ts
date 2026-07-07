// SESSION_SECRET の妥当性判定（環境非依存の純粋関数）。
// Next 側（lib/session/env.ts）と workers 側（workers/lib/session-secret.ts）の
// 両方がこの判定を共有する。判定を二重実装すると「片側だけ既知漏洩値を
// 拒否し損ねる」形の設定事故が起きるため、判定ロジックはここに一点集約する。
// 呼び出し側ごとに異なるのはエラーメッセージ（Next 向け / wrangler 向け）だけ
// なので、ここでは判定結果のみを返す。

// 開発の初期に wrangler.jsonc の vars へ平文コミットしてしまい、
// git 履歴に永久に残った値。本番で誤って再利用されないよう拒否する。
export const KNOWN_INSECURE_SECRETS: readonly string[] = [
  "dev-session-secret-change-in-production!!",
];

const MIN_SECRET_LENGTH = 16;

export type SessionSecretIssue = "missing-or-short" | "known-insecure";

export function sessionSecretIssue(
  secret: string | undefined,
): SessionSecretIssue | null {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return "missing-or-short";
  }
  if (KNOWN_INSECURE_SECRETS.includes(secret)) {
    return "known-insecure";
  }
  return null;
}

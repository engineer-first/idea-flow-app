// SESSION_SECRET の妥当性検証（環境非依存の純粋関数）。
// Next 側（lib/session/env.ts）と workers 側（workers/lib/session-secret.ts）は
// どちらもこの判定ロジックを共有する。呼び出し側のエラーメッセージ（Next 向け /
// wrangler 向け）は異なるため、判定結果だけをここで返す。
import { describe, expect, it } from "vitest";
import { sessionSecretIssue } from "@/lib/session/secret";

const VALID = "a-sufficiently-long-random-secret-value";
const KNOWN_LEAKED = "dev-session-secret-change-in-production!!";

describe("sessionSecretIssue", () => {
  it("未設定は missing-or-short", () => {
    expect(sessionSecretIssue(undefined)).toBe("missing-or-short");
  });

  it("短すぎる秘密は missing-or-short", () => {
    expect(sessionSecretIssue("short")).toBe("missing-or-short");
  });

  it("git 履歴に漏れた既知の値は known-insecure", () => {
    expect(sessionSecretIssue(KNOWN_LEAKED)).toBe("known-insecure");
  });

  it("十分な長さで既知漏洩値でなければ null（問題なし）", () => {
    expect(sessionSecretIssue(VALID)).toBeNull();
  });
});

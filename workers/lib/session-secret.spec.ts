// SESSION_SECRET のフェイルファスト検証。
// 本番で secret を設定し忘れると env.SESSION_SECRET が undefined になる。
// その状態で既知のフォールバック値へ暗黙に落ちると、リポジトリを読める攻撃者が
// JWT を偽造できてしまう。そうならないよう「設定漏れは起動時に落とす」。
import { describe, expect, it } from "vitest";
import { KNOWN_INSECURE_SECRETS, requireSessionSecret } from "./session-secret";

describe("requireSessionSecret", () => {
  it("十分な長さの秘密はそのまま返す", () => {
    const secret = "a-sufficiently-long-random-secret-value";
    expect(requireSessionSecret(secret)).toBe(secret);
  });

  it("undefined は拒否する（本番で secret 設定漏れ）", () => {
    expect(() => requireSessionSecret(undefined)).toThrow();
  });

  it("空文字は拒否する", () => {
    expect(() => requireSessionSecret("")).toThrow();
  });

  it("短すぎる秘密は拒否する（総当たり耐性不足）", () => {
    expect(() => requireSessionSecret("short")).toThrow();
  });

  it("git 履歴に漏れた既知の値は拒否する", () => {
    for (const leaked of KNOWN_INSECURE_SECRETS) {
      expect(() => requireSessionSecret(leaked)).toThrow();
    }
  });
});

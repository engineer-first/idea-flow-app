// 招待コード生成の仕様。Supabase 時代の internal.generate_invite_code() から移植:
// 誤読しやすい 0/O, 1/I を除いた32文字アルファベットから6文字を選ぶ。
import { describe, expect, it, vi } from "vitest";
import { generateInviteCode, INVITE_CODE_ALPHABET } from "./invite-code";

describe("generateInviteCode", () => {
  it("6文字のコードを生成する", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("アルファベットは 0/O/1/I を除いた32文字", () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(32);
    for (const ambiguous of ["0", "O", "1", "I"]) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("生成されるコードはアルファベットの文字のみで構成される", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      for (const ch of code) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("既定の乱数源は予測可能な Math.random に依存しない", () => {
    // 招待コードはルーム参加を許可する事実上のベアラートークン。
    // Math.random (xorshift128+) は出力の観測から内部状態を復元できるため、
    // 既定では CSPRNG を使うことを固定する。
    const spy = vi.spyOn(Math, "random");
    try {
      generateInviteCode();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("乱数源を注入でき、決定的に生成できる", () => {
    const first = generateInviteCode(() => 0);
    const last = generateInviteCode(() => 0.999999);
    expect(first).toBe(INVITE_CODE_ALPHABET[0]?.repeat(6));
    expect(last).toBe(INVITE_CODE_ALPHABET[31]?.repeat(6));
  });
});

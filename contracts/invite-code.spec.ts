// 招待コード生成の仕様。誤読しやすい 0/O, 1/I を除いた32文字アルファベットから
// 6文字を選ぶ。
import { describe, expect, it, vi } from "vitest";
import {
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/contracts/invite-code";

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

describe("normalizeInviteCode", () => {
  it("小文字を大文字に変換する", () => {
    expect(normalizeInviteCode("ab12cd")).toBe("AB12CD");
  });

  it("前後の空白を取り除く", () => {
    expect(normalizeInviteCode("  ab12cd  ")).toBe("AB12CD");
  });

  it("英数字以外の文字を取り除く", () => {
    expect(normalizeInviteCode("ab-12 cd!")).toBe("AB12CD");
  });
});

describe("isValidInviteCode", () => {
  it("大文字英数字6桁は有効", () => {
    expect(isValidInviteCode("AB12CD")).toBe(true);
  });

  it("5桁以下は無効", () => {
    expect(isValidInviteCode("AB12C")).toBe(false);
  });

  it("7桁以上は無効", () => {
    expect(isValidInviteCode("AB12CDE")).toBe(false);
  });

  it("小文字混じりは無効", () => {
    expect(isValidInviteCode("ab12cd")).toBe(false);
  });

  it("記号を含む場合は無効", () => {
    expect(isValidInviteCode("AB12-D")).toBe(false);
  });

  it("空文字は無効", () => {
    expect(isValidInviteCode("")).toBe(false);
  });
});

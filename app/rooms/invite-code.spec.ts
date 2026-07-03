import { describe, expect, it } from "vitest";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/app/rooms/invite-code";

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

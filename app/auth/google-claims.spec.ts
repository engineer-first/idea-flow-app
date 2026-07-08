import { describe, expect, it } from "vitest";
import { isEmailVerified } from "@/app/auth/google-claims";

describe("isEmailVerified", () => {
  it("email_verified が true のとき検証済みとみなす", () => {
    expect(isEmailVerified({ email_verified: true })).toBe(true);
  });

  it("email_verified が false のとき未検証とみなす", () => {
    expect(isEmailVerified({ email_verified: false })).toBe(false);
  });

  it("email_verified が欠落しているときは未検証とみなす（fail-closed）", () => {
    // api-worker 側の upsert は email で既存アカウントへリンクするため、
    // クレーム欠落を検証済み扱いにすると未検証メールでの合流を許してしまう。
    expect(isEmailVerified({})).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  getLoginErrorPath,
  getSupabaseConfigurationErrorLoginPath,
  sanitizeNextPath,
} from "@/app/auth/redirects";

describe("sanitizeNextPath", () => {
  it("相対パスを維持する", () => {
    expect(sanitizeNextPath("/invite/abc123?from=login")).toBe(
      "/invite/abc123?from=login",
    );
  });

  it("外部URLをhomeへ丸める", () => {
    expect(sanitizeNextPath("https://example.com/invite/abc123")).toBe("/");
    expect(sanitizeNextPath("//example.com/invite/abc123")).toBe("/");
  });

  it("不正な値をhomeへ丸める", () => {
    expect(sanitizeNextPath(null)).toBe("/");
    expect(sanitizeNextPath("invite/abc123")).toBe("/");
    expect(sanitizeNextPath("/\\example.com")).toBe("/");
  });
});

describe("getLoginErrorPath", () => {
  it("ログインエラー文言をURLエンコードして返す", () => {
    expect(getLoginErrorPath("ログインに失敗しました。")).toBe(
      "/login?error=%E3%83%AD%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%AB%E5%A4%B1%E6%95%97%E3%81%97%E3%81%BE%E3%81%97%E3%81%9F%E3%80%82",
    );
  });

  it("nextが指定された場合はログイン後の遷移先も維持する", () => {
    expect(
      getLoginErrorPath("Invalid login credentials", "/invite/abc123"),
    ).toBe("/login?error=Invalid+login+credentials&next=%2Finvite%2Fabc123");
  });
});

describe("getSupabaseConfigurationErrorLoginPath", () => {
  it("Supabase設定不足のログインエラーURLを返す", () => {
    expect(getSupabaseConfigurationErrorLoginPath()).toBe(
      "/login?error=Supabase%E3%81%AE%E7%92%B0%E5%A2%83%E5%A4%89%E6%95%B0%E3%82%92%E8%A8%AD%E5%AE%9A%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82",
    );
  });
});

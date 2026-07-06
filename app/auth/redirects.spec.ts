import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "@/app/auth/redirects";

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

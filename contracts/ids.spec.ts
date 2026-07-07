import { describe, expect, it } from "vitest";
import { isUuid } from "@/contracts/ids";

describe("isUuid", () => {
  it("crypto.randomUUID 形式（小文字 8-4-4-4-12）を受け入れる", () => {
    expect(isUuid("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
  });

  it("大文字も受け入れる（大文字小文字を区別しない）", () => {
    expect(isUuid("123E4567-E89B-42D3-A456-426614174000")).toBe(true);
  });

  it("UUID でない文字列は拒否する", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("123e4567e89b42d3a456426614174000")).toBe(false);
  });

  it("余分な前後の文字が付いた形は拒否する（パスパラメータの混入対策）", () => {
    expect(isUuid("123e4567-e89b-42d3-a456-426614174000/ws")).toBe(false);
    expect(isUuid(" 123e4567-e89b-42d3-a456-426614174000")).toBe(false);
  });
});

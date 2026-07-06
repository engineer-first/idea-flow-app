import { describe, expect, it } from "vitest";
import {
  getInviteFailureRedirectPath,
  isInvalidOrExpiredInviteError,
} from "@/app/invite/invite-errors";

describe("invite errors", () => {
  it("存在しない招待コードと期限切れを期限切れ画面へ振り分ける", () => {
    expect(isInvalidOrExpiredInviteError({ code: "IF001" })).toBe(true);
    expect(isInvalidOrExpiredInviteError({ code: "IF002" })).toBe(true);
    expect(getInviteFailureRedirectPath("abc123", { code: "IF002" })).toBe(
      "/invite/abc123/expired",
    );
  });

  it("未認証エラーは期限切れ扱いにしない", () => {
    expect(isInvalidOrExpiredInviteError({ code: "IF003" })).toBe(false);
  });
});

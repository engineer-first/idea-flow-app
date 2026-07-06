import { describe, expect, it, vi } from "vitest";
import { unwrapRoomQueryResult } from "@/app/rooms/[inviteCode]/room-query-results";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

describe("unwrapRoomQueryResult", () => {
  it("Supabaseの取得エラーは期限切れ扱いにせず例外にする", () => {
    expect(() =>
      unwrapRoomQueryResult(
        {
          data: null,
          error: { message: "permission denied for table rooms" },
        },
        "abc123",
      ),
    ).toThrow("permission denied for table rooms");
  });

  it("dataがnullでerrorがない場合だけ期限切れ/無効画面へ送る", () => {
    expect(() =>
      unwrapRoomQueryResult({ data: null, error: null }, "abc123"),
    ).toThrow("redirect:/invite/abc123/expired");
  });

  it("dataがある場合はそのまま返す", () => {
    const data = { id: 1 };

    expect(unwrapRoomQueryResult({ data, error: null }, "abc123")).toBe(data);
  });
});

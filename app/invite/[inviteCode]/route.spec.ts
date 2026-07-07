// @vitest-environment node
// 招待URL エントリの遷移分岐のテスト。
// 「無効な招待コード」（400/404）と「API 側の障害」（5xx）を混同しないこと、
// セッション切れ（401）はログインへ戻ることを検証する。すべて invalid に
// 潰すと、api-worker 障害時に利用者へ「招待が無効」と誤案内してしまう。
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, getCurrentUserMock } = vi.hoisted(() => ({
  apiFetchMock:
    vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ apiFetch: apiFetchMock }));
vi.mock("@/lib/session/current-user", () => ({
  getCurrentUser: getCurrentUserMock,
}));

import { GET } from "@/app/invite/[inviteCode]/route";

function inviteRequest(code = "ABC123") {
  return {
    request: new NextRequest(`https://app.example.com/invite/${code}`),
    context: { params: Promise.resolve({ inviteCode: code }) },
  };
}

beforeEach(() => {
  getCurrentUserMock.mockResolvedValue({
    sub: "123e4567-e89b-12d3-a456-426614174000",
    email: "dev@example.com",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /invite/[inviteCode]", () => {
  it("未ログインなら戻り先つきでログインへリダイレクトする", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { request, context } = inviteRequest();
    const res = await GET(request, context);

    expect(res.headers.get("location")).toBe(
      `https://app.example.com/login?next=${encodeURIComponent("/invite/ABC123")}`,
    );
  });

  it("参加に成功したらルームページへリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(
      Response.json({ roomId: "123e4567-e89b-12d3-a456-426614174000" }),
    );

    const { request, context } = inviteRequest();
    const res = await GET(request, context);

    expect(res.headers.get("location")).toBe(
      "https://app.example.com/rooms/123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it.each([
    400, 404,
  ])("%i（無効な招待コード）は invalid ページへリダイレクトする", async (status) => {
    apiFetchMock.mockResolvedValue(new Response("not found", { status }));

    const { request, context } = inviteRequest();
    const res = await GET(request, context);

    expect(res.headers.get("location")).toBe(
      "https://app.example.com/invite/ABC123/invalid",
    );
  });

  it("401（セッション切れ）は invalid ではなくログインへ戻す", async () => {
    apiFetchMock.mockResolvedValue(
      new Response("unauthorized", { status: 401 }),
    );

    const { request, context } = inviteRequest();
    const res = await GET(request, context);

    expect(res.headers.get("location")).toBe(
      `https://app.example.com/login?next=${encodeURIComponent("/invite/ABC123")}`,
    );
  });

  it("5xx（api-worker 障害）は invalid に潰さず例外にする（error boundary 行き）", async () => {
    apiFetchMock.mockResolvedValue(new Response("oops", { status: 503 }));

    const { request, context } = inviteRequest();

    await expect(GET(request, context)).rejects.toThrow();
  });

  it("2xx でも不正 JSON なら invalid ページへリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(new Response("<html>error</html>"));

    const { request, context } = inviteRequest();
    const res = await GET(request, context);

    expect(res.headers.get("location")).toBe(
      "https://app.example.com/invite/ABC123/invalid",
    );
  });
});

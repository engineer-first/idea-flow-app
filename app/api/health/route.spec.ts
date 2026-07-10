// @vitest-environment node
// /api/health の疎通確認テスト。
// Next.js Worker -> (サービスバインディング) -> api-worker の経路が
// 生きているかを、apiFetch("/api/health") への委譲だけで検証する。
// 認可・セッションには関与しない（意図的に誰でも叩ける）。
import { describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn<(path: string) => Promise<Response>>(),
}));

vi.mock("@/lib/api-client", () => ({ apiFetch: apiFetchMock }));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("api-worker の /api/health をそのまま呼び、ok:true を返す", async () => {
    apiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const res = await GET();

    expect(apiFetchMock).toHaveBeenCalledWith("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("api-worker に到達できない場合は 503 を返す", async () => {
    apiFetchMock.mockRejectedValue(new Error("network error"));

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
  });
});

// @vitest-environment node
// apiFetch の境界契約: セッション Cookie の転送と、外部呼び出しの打ち切り
// （タイムアウト signal）が配線されていることを検証する。
// タイムアウトが無いと api-worker の無応答が Server Action の無期限ブロックになる。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCookieMock } = vi.hoisted(() => ({
  getCookieMock: vi.fn<() => { value: string } | undefined>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: getCookieMock }),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  // Cloudflare コンテキスト外（通常の next dev / テスト）を再現する。
  getCloudflareContext: () => {
    throw new Error("not in cloudflare context");
  },
}));

import { apiFetch } from "@/lib/api-client";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("API_WORKER_URL", "http://localhost:8787");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response("{}"));
  getCookieMock.mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("apiFetch", () => {
  it("セッション Cookie があれば転送する", async () => {
    getCookieMock.mockReturnValue({ value: "token-value" });

    await apiFetch("/api/rooms");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("Cookie")).toContain("token-value");
  });

  it("外部呼び出しにタイムアウト用の AbortSignal を設定する", async () => {
    await apiFetch("/api/rooms");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("呼び出し側が signal を渡した場合はそちらを優先する", async () => {
    const controller = new AbortController();

    await apiFetch("/api/rooms", { signal: controller.signal });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBe(controller.signal);
  });
});

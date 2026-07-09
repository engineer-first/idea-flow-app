// @vitest-environment node
// createRoom / joinRoom の Server Actions 境界のテスト。
// api-worker の応答が「非 2xx」「2xx だが不正 JSON」のどちらでも、未処理例外に
// せずエラーリダイレクトへ倒れること（利用者に汎用 500 を見せない）を検証する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, getCurrentUserMock, redirectMock } = vi.hoisted(() => ({
  apiFetchMock:
    vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(),
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn<(url: string) => never>(),
}));

vi.mock("@/lib/api-client", () => ({ apiFetch: apiFetchMock }));
vi.mock("@/lib/session/current-user", () => ({
  getCurrentUser: getCurrentUserMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { createRoom, joinRoom, leaveRoom } from "@/app/rooms/actions";

// 実物の redirect() は例外を投げて以降の処理を打ち切る。同じ制御フローを再現する。
class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect: ${url}`);
  }
}

async function callAndGetRedirect(
  action: () => Promise<void>,
): Promise<string> {
  try {
    await action();
  } catch (error) {
    if (error instanceof RedirectSignal) {
      return error.url;
    }
    throw error;
  }
  throw new Error("redirect が呼ばれませんでした");
}

function joinFormData(code: string): FormData {
  const formData = new FormData();
  formData.set("code", code);
  return formData;
}

beforeEach(() => {
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
  getCurrentUserMock.mockResolvedValue({
    sub: "123e4567-e89b-12d3-a456-426614174000",
    email: "dev@example.com",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createRoom", () => {
  it("未認証なら /login へリダイレクトする", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    expect(await callAndGetRedirect(() => createRoom())).toBe("/login");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("作成に成功したらスタート画面へリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(
      Response.json({
        roomId: "123e4567-e89b-42d3-a456-426614174000",
        inviteCode: "ABC123",
      }),
    );

    // ?created=1 クエリで start ページ側に「ルームを作成しました」通知を出す
    expect(await callAndGetRedirect(() => createRoom())).toBe(
      "/rooms/123e4567-e89b-42d3-a456-426614174000/start?created=1",
    );
  });

  it("API が非 2xx ならエラー付きでトップへ戻す", async () => {
    apiFetchMock.mockResolvedValue(new Response("error", { status: 500 }));

    expect(await callAndGetRedirect(() => createRoom())).toContain("/?error=");
  });

  it("API が 2xx でも不正 JSON ならエラー付きでトップへ戻す", async () => {
    apiFetchMock.mockResolvedValue(new Response("<html>gateway error</html>"));

    expect(await callAndGetRedirect(() => createRoom())).toContain("/?error=");
  });
});

describe("joinRoom", () => {
  it("形式不正の招待コードはエラー付きでトップへ戻す", async () => {
    expect(
      await callAndGetRedirect(() => joinRoom(joinFormData("bad"))),
    ).toContain("/?error=");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("参加に成功したらスタート画面へリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(
      Response.json({ roomId: "123e4567-e89b-42d3-a456-426614174000" }),
    );

    // ?joined=1 クエリで start ページ側に「ルームに参加しました」通知を出す
    expect(
      await callAndGetRedirect(() => joinRoom(joinFormData("ABC123"))),
    ).toBe("/rooms/123e4567-e89b-42d3-a456-426614174000/start?joined=1");
  });

  it("API が 2xx でも不正 JSON ならエラー付きでトップへ戻す", async () => {
    apiFetchMock.mockResolvedValue(new Response("<html>gateway error</html>"));

    expect(
      await callAndGetRedirect(() => joinRoom(joinFormData("ABC123"))),
    ).toContain("/?error=");
  });
});

describe("leaveRoom", () => {
  function leaveFormData(roomId: string): FormData {
    const formData = new FormData();
    formData.set("roomId", roomId);
    return formData;
  }

  it("未認証なら /login へリダイレクトする", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    expect(
      await callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).toBe("/login");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("roomId が UUID 形式でなければ / へリダイレクトする", async () => {
    expect(
      await callAndGetRedirect(() => leaveRoom(leaveFormData("not-uuid"))),
    ).toBe("/");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("退出に成功したら / へリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(
      await callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).toBe("/");
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/rooms/${VALID_ROOM_ID}/leave`,
      { method: "POST" },
    );
  });

  it("404（既に退出済み・非メンバー）は / へリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(new Response("not found", { status: 404 }));

    expect(
      await callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).toBe("/");
  });

  it("5xx は例外を投げて error boundary 行き", async () => {
    apiFetchMock.mockResolvedValue(new Response("oops", { status: 503 }));

    await expect(
      callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).rejects.toThrow();
  });

  it("409（lobby 中のホスト退出拒否）はメッセージ付きで例外を投げる", async () => {
    apiFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "開始前のルームではホストは退出できません。",
        }),
        { status: 409 },
      ),
    );

    await expect(
      callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).rejects.toThrow("開始前のルームではホストは退出できません。");
  });
});

const VALID_ROOM_ID = "123e4567-e89b-42d3-a456-426614174000";

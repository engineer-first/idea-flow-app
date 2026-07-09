// @vitest-environment node
// createRoom / joinRoom の Server Actions 境界のテスト。
// api-worker の応答が「非 2xx」「2xx だが不正 JSON」のどちらでも、未処理例外に
// せず ok: false で返すこと（create/join）。leave は従来どおり redirect。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiFetchMock,
  getCurrentUserMock,
  redirectMock,
  lookupRoomByInviteCodeMock,
} = vi.hoisted(() => ({
  apiFetchMock:
    vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(),
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn<(url: string) => never>(),
  lookupRoomByInviteCodeMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: apiFetchMock,
  lookupRoomByInviteCode: lookupRoomByInviteCodeMock,
}));
vi.mock("@/lib/session/current-user", () => ({
  getCurrentUser: getCurrentUserMock,
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import {
  createRoom,
  joinRoom,
  leaveRoom,
  lookupInviteRoom,
} from "@/app/rooms/actions";

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

  it("作成に成功したら roomId を返す（遷移と toast はクライアント側）", async () => {
    apiFetchMock.mockResolvedValue(
      Response.json({
        roomId: "123e4567-e89b-42d3-a456-426614174000",
        inviteCode: "ABC123",
      }),
    );

    await expect(createRoom()).resolves.toEqual({
      ok: true,
      roomId: "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("API が非 2xx なら ok: false を返す", async () => {
    apiFetchMock.mockResolvedValue(new Response("error", { status: 500 }));

    await expect(createRoom()).resolves.toEqual({
      ok: false,
      error: "ルームを作成できませんでした。",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("API が 2xx でも不正 JSON なら ok: false を返す", async () => {
    apiFetchMock.mockResolvedValue(new Response("<html>gateway error</html>"));

    await expect(createRoom()).resolves.toEqual({
      ok: false,
      error: "ルームを作成できませんでした。",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("lookupInviteRoom", () => {
  it("形式不正の招待コードは ok: false を返す", async () => {
    await expect(lookupInviteRoom("bad")).resolves.toEqual({
      ok: false,
      error: "招待コードは英数字6桁で入力してください。",
    });
    expect(lookupRoomByInviteCodeMock).not.toHaveBeenCalled();
  });

  it("ルームが無ければ ok: false を返す", async () => {
    lookupRoomByInviteCodeMock.mockResolvedValueOnce(null);
    await expect(lookupInviteRoom("ABC123")).resolves.toEqual({
      ok: false,
      error: "ルームが見つかりませんでした。",
    });
  });

  it("見つかれば hostName を返す", async () => {
    lookupRoomByInviteCodeMock.mockResolvedValueOnce({
      roomId: "123e4567-e89b-42d3-a456-426614174000",
      inviteCode: "ABC123",
      hostName: "田中太郎",
    });
    await expect(lookupInviteRoom("ABC123")).resolves.toEqual({
      ok: true,
      hostName: "田中太郎",
      inviteCode: "ABC123",
    });
  });
});

describe("joinRoom", () => {
  it("形式不正の招待コードは ok: false を返す", async () => {
    await expect(joinRoom(joinFormData("bad"))).resolves.toEqual({
      ok: false,
      error: "招待コードは英数字6桁で入力してください。",
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("参加に成功したら roomId を返す（遷移と toast はクライアント側）", async () => {
    apiFetchMock.mockResolvedValue(
      Response.json({ roomId: "123e4567-e89b-42d3-a456-426614174000" }),
    );

    await expect(joinRoom(joinFormData("ABC123"))).resolves.toEqual({
      ok: true,
      roomId: "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("API が 2xx でも不正 JSON なら ok: false を返す", async () => {
    apiFetchMock.mockResolvedValue(new Response("<html>gateway error</html>"));

    await expect(joinRoom(joinFormData("ABC123"))).resolves.toEqual({
      ok: false,
      error: "ルームが見つかりませんでした。",
    });
    expect(redirectMock).not.toHaveBeenCalled();
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

  it("roomId が UUID 形式でなければ /home へリダイレクトする", async () => {
    expect(
      await callAndGetRedirect(() => leaveRoom(leaveFormData("not-uuid"))),
    ).toBe("/home");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("退出に成功したら /home へリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(
      await callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).toBe("/home");
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/rooms/${VALID_ROOM_ID}/leave`,
      { method: "POST" },
    );
  });

  it("404（既に退出済み・非メンバー）は /home へリダイレクトする", async () => {
    apiFetchMock.mockResolvedValue(new Response("not found", { status: 404 }));

    expect(
      await callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).toBe("/home");
  });

  it("5xx は例外を投げて error boundary 行き", async () => {
    apiFetchMock.mockResolvedValue(new Response("oops", { status: 503 }));

    await expect(
      callAndGetRedirect(() => leaveRoom(leaveFormData(VALID_ROOM_ID))),
    ).rejects.toThrow();
  });

});

const VALID_ROOM_ID = "123e4567-e89b-42d3-a456-426614174000";

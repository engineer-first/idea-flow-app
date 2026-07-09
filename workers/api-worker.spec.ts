// api-worker の統合テスト。Supabase 時代の pgTAP テスト（認可の肯定/否定系・
// join の冪等性）をワーカー境界のテストとして移植したもの。
// - anon（セッションなし）は何もできない
// - 非メンバーにはルームの存在自体を見せない (404)
// - join は冪等（複数回呼んでもメンバーは重複しない）
import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { TOKEN_AUDIENCE } from "../contracts/session";
import { signToken } from "../lib/session/token";
import { joinRoomAs, listMemberIds } from "./test-helpers";

const OWNER = {
  sub: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.test",
  name: "Owner",
};
const MEMBER = {
  sub: "22222222-2222-4222-8222-222222222222",
  email: "member@example.test",
  name: "Member",
};
const OUTSIDER = {
  sub: "33333333-3333-4333-8333-333333333333",
  email: "viewer@example.test",
  name: "Outsider",
};

async function sessionCookie(user: typeof OWNER): Promise<string> {
  const token = await signToken(user, {
    secret: env.SESSION_SECRET,
    audience: TOKEN_AUDIENCE.session,
    expiresInSeconds: 600,
  });
  return `idea_flow_session=${token}`;
}

async function createRoomAs(
  user: typeof OWNER,
): Promise<{ roomId: string; inviteCode: string }> {
  const res = await SELF.fetch("https://api.test/api/rooms", {
    method: "POST",
    headers: { Cookie: await sessionCookie(user) },
  });
  expect(res.status).toBe(200);
  return res.json();
}

describe("認証ゲート（pgTAP: anon の視点）", () => {
  it("セッションなしではルームを作成できない", async () => {
    const res = await SELF.fetch("https://api.test/api/rooms", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("セッションなしではルーム参加できない", async () => {
    const res = await SELF.fetch("https://api.test/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABC234" }),
    });
    expect(res.status).toBe(401);
  });

  it("セッションなしではルーム情報を取得できない", async () => {
    const res = await SELF.fetch(
      "https://api.test/api/rooms/11111111-1111-4111-8111-111111111111",
    );
    expect(res.status).toBe(401);
  });

  it("改ざんされたセッションは拒否される", async () => {
    const cookie = await sessionCookie(OWNER);
    const res = await SELF.fetch("https://api.test/api/rooms", {
      method: "POST",
      headers: { Cookie: `${cookie.slice(0, -3)}xxx` },
    });
    expect(res.status).toBe(401);
  });
});

describe("ルーム作成", () => {
  it("ルームを作成すると6桁の招待コードが発行され、host がメンバーになる", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    expect(roomId).toMatch(/^[0-9a-f-]{36}$/);
    expect(inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // pgTAP: 「create_room() は host を room_members に1件だけ登録する」
    const memberIds = await listMemberIds(roomId);
    expect(memberIds).toEqual([OWNER.sub]);
  });

  it("作成した host はルーム情報を取得できる（isHost=true, phase=lobby）", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
      headers: { Cookie: await sessionCookie(OWNER) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      roomId,
      inviteCode,
      isHost: true,
      hostUserId: OWNER.sub,
      phase: "lobby",
    });
  });
});

describe("ルーム情報（isHost / hostUserId / phase）", () => {
  it("参加者は isHost=false と hostUserId（作成者）を取得できる", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
      headers: { Cookie: await sessionCookie(MEMBER) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      roomId,
      inviteCode,
      isHost: false,
      hostUserId: OWNER.sub,
      phase: "lobby",
    });
  });
});

describe("メンバー一覧（GET /api/rooms/:id/members）", () => {
  it("メンバーは name 付きの参加者一覧を取得できる", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);
    const res = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/members`,
      { headers: { Cookie: await sessionCookie(OWNER) } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      members: [
        { userId: OWNER.sub, name: OWNER.name },
        { userId: MEMBER.sub, name: MEMBER.name },
      ],
    });
  });

  it("非メンバーは 404（ルームの存在自体を見せない）", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/members`,
      { headers: { Cookie: await sessionCookie(OUTSIDER) } },
    );
    expect(res.status).toBe(404);
  });

  it("セッションなしでは 401", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/members`,
    );
    expect(res.status).toBe(401);
  });
});

describe("可視性（pgTAP: 非メンバーの視点）", () => {
  it("非メンバーにはルームの存在自体を見せない (404)", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
      headers: { Cookie: await sessionCookie(OUTSIDER) },
    });
    expect(res.status).toBe(404);
  });

  it("存在しないルームも同じ 404 を返す（存在の推測をさせない）", async () => {
    const res = await SELF.fetch(
      "https://api.test/api/rooms/99999999-9999-4999-8999-999999999999",
      { headers: { Cookie: await sessionCookie(OUTSIDER) } },
    );
    expect(res.status).toBe(404);
  });
});

describe("ルーム参加（pgTAP: join_room）", () => {
  it("招待コードで参加すると、ルーム情報を取得できるようになる", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);

    const before = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
      headers: { Cookie: await sessionCookie(MEMBER) },
    });
    expect(before.status).toBe(404);

    const join = await SELF.fetch("https://api.test/api/rooms/join", {
      method: "POST",
      headers: {
        Cookie: await sessionCookie(MEMBER),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: inviteCode }),
    });
    expect(join.status).toBe(200);
    expect(await join.json()).toEqual({ roomId });

    const after = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
      headers: { Cookie: await sessionCookie(MEMBER) },
    });
    expect(after.status).toBe(200);
  });

  it("join は冪等（複数回参加してもメンバーは重複しない）", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);

    for (let i = 0; i < 3; i++) {
      const res = await SELF.fetch("https://api.test/api/rooms/join", {
        method: "POST",
        headers: {
          Cookie: await sessionCookie(MEMBER),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: inviteCode }),
      });
      expect(res.status).toBe(200);
    }

    const memberIds = await listMemberIds(roomId);
    expect(memberIds.sort()).toEqual([OWNER.sub, MEMBER.sub].sort());
  });

  it("小文字や空白まじりの招待コードも補正して受け付ける", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    const res = await SELF.fetch("https://api.test/api/rooms/join", {
      method: "POST",
      headers: {
        Cookie: await sessionCookie(MEMBER),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: ` ${inviteCode.toLowerCase()} ` }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ roomId });
  });

  it("存在しない招待コードは 404", async () => {
    const res = await SELF.fetch("https://api.test/api/rooms/join", {
      method: "POST",
      headers: {
        Cookie: await sessionCookie(MEMBER),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "ZZZZ99" }),
    });
    expect(res.status).toBe(404);
  });

  it("形式が不正な招待コードは 400", async () => {
    const res = await SELF.fetch("https://api.test/api/rooms/join", {
      method: "POST",
      headers: {
        Cookie: await sessionCookie(MEMBER),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "ab" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("ユーザー同期（ログイン時の upsert）", () => {
  async function assertionFor(
    payload: Record<string, unknown>,
  ): Promise<string> {
    return signToken(payload, {
      secret: env.SESSION_SECRET,
      audience: TOKEN_AUDIENCE.loginAssertion,
      expiresInSeconds: 60,
    });
  }

  it("dev ログイン主張でユーザーが作成され、同じ ID で冪等に更新される", async () => {
    const assertion = await assertionFor({
      kind: "dev",
      userId: OWNER.sub,
      email: OWNER.email,
      name: OWNER.name,
    });

    for (let i = 0; i < 2; i++) {
      const res = await SELF.fetch("https://api.test/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assertion }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ userId: OWNER.sub });
    }
  });

  it("google ログイン主張は googleSub で同一ユーザーに解決される", async () => {
    const assertion = await assertionFor({
      kind: "google",
      googleSub: "google-sub-123",
      email: "taro@example.test",
      name: "Taro",
    });

    const first = await SELF.fetch("https://api.test/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assertion }),
    });
    const { userId: firstId } = await first.json<{ userId: string }>();

    const second = await SELF.fetch("https://api.test/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assertion }),
    });
    const { userId: secondId } = await second.json<{ userId: string }>();

    expect(first.status).toBe(200);
    expect(firstId).toBe(secondId);
  });

  it("セッショントークンをログイン主張として流用できない（audience 分離）", async () => {
    const sessionToken = await signToken(
      { kind: "dev", userId: OWNER.sub, email: OWNER.email },
      {
        secret: env.SESSION_SECRET,
        audience: TOKEN_AUDIENCE.session,
        expiresInSeconds: 60,
      },
    );
    const res = await SELF.fetch("https://api.test/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assertion: sessionToken }),
    });
    expect(res.status).toBe(401);
  });
});

describe("退出（POST /api/rooms/:id/leave）", () => {
  it("メンバーは退出でき 204 を返す", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);

    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Cookie: await sessionCookie(MEMBER) },
    });
    expect(res.status).toBe(204);

    // 退出後のメンバー一覧には Member が居ない
    const membersRes = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/members`,
      { headers: { Cookie: await sessionCookie(OWNER) } },
    );
    const body = (await membersRes.json()) as { members: { userId: string }[] };
    expect(body.members.map((m) => m.userId)).toEqual([OWNER.sub]);
  });

  it("2 回目の退出は非メンバーのため 404（存在秘匿。クライアントは成功相当でよい）", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);

    const first = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/leave`,
      { method: "POST", headers: { Cookie: await sessionCookie(MEMBER) } },
    );
    expect(first.status).toBe(204);

    // 2 回目は既に非メンバー → 404（存在秘匿）
    const second = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/leave`,
      { method: "POST", headers: { Cookie: await sessionCookie(MEMBER) } },
    );
    expect(second.status).toBe(404);
  });

  it("lobby 中のホスト退出は 409", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Cookie: await sessionCookie(OWNER) },
    });
    expect(res.status).toBe(409);
  });

  it("writing 中ならホストも退出できる", async () => {
    const { roomId } = await createRoomAs(OWNER);
    // DO を writing に進めておく（lobby 中ホスト退出禁止の例外）
    const stub = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));
    await stub.setPhase("writing", OWNER.sub, OWNER.sub);

    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Cookie: await sessionCookie(OWNER) },
    });
    expect(res.status).toBe(204);
  });

  it("非メンバーは 404（ルームの存在自体を見せない）", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Cookie: await sessionCookie(OUTSIDER) },
    });
    expect(res.status).toBe(404);
  });

  it("未ログインは 401", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("退出したユーザーは同じ招待コードから再 join できる", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);

    // 退出
    await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Cookie: await sessionCookie(MEMBER) },
    });

    // 再 join
    const rejoin = await SELF.fetch("https://api.test/api/rooms/join", {
      method: "POST",
      headers: {
        Cookie: await sessionCookie(MEMBER),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: inviteCode }),
    });
    expect(rejoin.status).toBe(200);
  });
});

describe("WebSocket 接続の認可", () => {
  it("セッションなしの WS 接続は 401", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/ws`, {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(401);
  });

  it("非メンバーの WS 接続は 404", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/ws`, {
      headers: {
        Upgrade: "websocket",
        Cookie: await sessionCookie(OUTSIDER),
      },
    });
    expect(res.status).toBe(404);
  });

  it("メンバーの WS 接続は 101 で確立する", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}/ws`, {
      headers: {
        Upgrade: "websocket",
        Cookie: await sessionCookie(OWNER),
      },
    });
    expect(res.status).toBe(101);
    res.webSocket?.accept();
    res.webSocket?.close();
  });
});

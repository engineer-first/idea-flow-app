// RoomDO 単体の契約テスト。
// メンバーシップの真実（join の冪等性・isMember 判定）と、
// api-worker を経由しない到達への深層防御を検証する。
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { USER_ID_HEADER } from "./room-do";
import { runInRoomDO } from "./test-helpers";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function roomStub(name: string) {
  return env.ROOM_DO.get(env.ROOM_DO.idFromName(name));
}

describe("RoomDO メンバーシップ", () => {
  it("join は冪等（複数回呼んでもメンバーは1件のまま）", async () => {
    const stub = roomStub("room-idempotent");
    await stub.join(USER_A);
    await stub.join(USER_A);
    await stub.join(USER_A);
    expect(await stub.getMemberIds()).toEqual([USER_A]);
  });

  it("メンバーでないユーザーは isMember で false になる", async () => {
    const stub = roomStub("room-membership");
    await stub.join(USER_A);
    expect(await stub.isMember(USER_A)).toBe(true);
    expect(await stub.isMember(USER_B)).toBe(false);
  });

  it("getMemberIds は参加順に返す", async () => {
    const memberIds = await runInRoomDO("room-order", async (instance) => {
      instance.join(USER_A);
      instance.join(USER_B);
      return instance.getMemberIds();
    });
    expect(memberIds).toEqual([USER_A, USER_B]);
  });
});

describe("RoomDO WebSocket の深層防御", () => {
  it("WebSocket 以外のリクエストは 426", async () => {
    const res = await roomStub("room-guard").fetch("https://do/anything");
    expect(res.status).toBe(426);
  });

  it("ユーザーIDヘッダーなしの upgrade は 403（api-worker を経由しない到達）", async () => {
    const res = await roomStub("room-guard").fetch("https://do/ws", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(403);
  });

  it("非メンバーのユーザーIDでの upgrade は 403", async () => {
    const res = await roomStub("room-guard").fetch("https://do/ws", {
      headers: { Upgrade: "websocket", [USER_ID_HEADER]: USER_B },
    });
    expect(res.status).toBe(403);
  });

  it("メンバーのユーザーIDでの upgrade は 101", async () => {
    const stub = roomStub("room-guard-member");
    await stub.join(USER_A);
    const res = await stub.fetch("https://do/ws", {
      headers: { Upgrade: "websocket", [USER_ID_HEADER]: USER_A },
    });
    expect(res.status).toBe(101);
    res.webSocket?.accept();
    res.webSocket?.close();
  });
});

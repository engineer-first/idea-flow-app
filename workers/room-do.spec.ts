// RoomDO 単体の契約テスト。
// メンバーシップの真実（upsert の冪等性・isMember 判定・name の保持・進行状態）と、
// api-worker を経由しない到達への深層防御を検証する。
// Realtime 配信（新規メンバーの member_joined broadcast）は
// room-protocol.spec.ts の E2E テスト（実 WS 接続）で検証する。
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { NOTE_COLOR_PALETTE } from "../contracts/room-protocol";
import { HOST_ID_HEADER, USER_ID_HEADER } from "./room-do";
import { listMemberIds, runInRoomDO } from "./test-helpers";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const NOTE_COLOR_PATTERN = new RegExp(`^(${NOTE_COLOR_PALETTE.join("|")})$`);

function userIdAt(index: number): string {
  return `${index.toString().padStart(8, "0")}-0000-4000-8000-000000000000`;
}

function roomStub(name: string) {
  return env.ROOM_DO.get(env.ROOM_DO.idFromName(name));
}

async function connectDirectly(
  roomName: string,
  userId: string,
  hostId: string,
): Promise<WebSocket> {
  const res = await roomStub(roomName).fetch("https://do/ws", {
    headers: {
      Upgrade: "websocket",
      [USER_ID_HEADER]: userId,
      [HOST_ID_HEADER]: hostId,
    },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket;
  if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
  ws.accept();
  await new Promise<MessageEvent>((resolve) => {
    ws.addEventListener("message", resolve, { once: true });
  });
  return ws;
}

function nextJson(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.addEventListener(
      "message",
      (event) => resolve(JSON.parse(String(event.data))),
      { once: true },
    );
  });
}

describe("RoomDO メンバーシップ", () => {
  it("upsertMember は冪等（複数回呼んでもメンバーは1件のまま）", async () => {
    const stub = roomStub("room-idempotent");
    await stub.upsertMember(USER_A, "Alpha");
    await stub.upsertMember(USER_A, "Alpha");
    await stub.upsertMember(USER_A, "Alpha");
    expect(await listMemberIds("room-idempotent")).toEqual([USER_A]);
  });

  it("upsertMember は冪等で name を最新に同期する", async () => {
    const stub = roomStub("room-upsert-name");
    await stub.upsertMember(USER_A, "古い名前");
    await stub.upsertMember(USER_A, "新しい名前");
    await stub.upsertMember(USER_A, "新しい名前");
    const members = await stub.listMembers();
    expect(members).toEqual([
      {
        userId: USER_A,
        name: "新しい名前",
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    ]);
  });

  it("upsertMember の name が undefined なら空文字で保存される", async () => {
    const stub = roomStub("room-upsert-undef");
    await stub.upsertMember(USER_A, undefined);
    const members = await stub.listMembers();
    expect(members).toEqual([
      {
        userId: USER_A,
        name: "",
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    ]);
  });

  it("listMembers は参加順（joined_at 昇順）で返す", async () => {
    const stub = roomStub("room-list-order");
    await stub.upsertMember(USER_A, "Alpha");
    await stub.upsertMember(USER_B, "Beta");
    expect(await stub.listMembers()).toEqual([
      {
        userId: USER_A,
        name: "Alpha",
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
      {
        userId: USER_B,
        name: "Beta",
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    ]);
  });

  it("listMembers は joined_at が同じメンバーを user_id 昇順で返す", async () => {
    const roomId = "room-list-tie-break";
    await runInRoomDO(roomId, (_instance, state) => {
      const joinedAt = "2026-07-12T00:00:00.000Z";
      state.storage.sql.exec(
        `INSERT INTO members (user_id, joined_at, name, color)
         VALUES (?1, ?3, 'Beta', 'blue'), (?2, ?3, 'Alpha', 'yellow')`,
        USER_B,
        USER_A,
        joinedAt,
      );
    });

    expect(await roomStub(roomId).listMembers()).toEqual([
      { userId: USER_A, name: "Alpha", color: "yellow" },
      { userId: USER_B, name: "Beta", color: "blue" },
    ]);
  });

  it("メンバーでないユーザーは isMember で false になる", async () => {
    const stub = roomStub("room-membership");
    await stub.upsertMember(USER_A, "Alpha");
    expect(await stub.isMember(USER_A)).toBe(true);
    expect(await stub.isMember(USER_B)).toBe(false);
  });

  it("メンバーは参加順に並ぶ", async () => {
    const stub = roomStub("room-order");
    await stub.upsertMember(USER_A, "Alpha");
    await stub.upsertMember(USER_B, "Beta");
    expect(await listMemberIds("room-order")).toEqual([USER_A, USER_B]);
  });

  it("通算20名には重複しない色を割り当て、21人目は拒否する", async () => {
    const roomId = "room-member-color-capacity";
    const stub = roomStub(roomId);

    for (let index = 1; index <= 20; index++) {
      await expect(
        stub.upsertMember(userIdAt(index), `Member ${index}`),
      ).resolves.toEqual({
        ok: true,
      });
    }

    const members = await stub.listMembers();
    expect(new Set(members.map((member) => member.color)).size).toBe(20);
    await expect(stub.upsertMember(userIdAt(21), "Member 21")).resolves.toEqual(
      {
        ok: false,
        reason: "room-full",
      },
    );
    expect(await listMemberIds(roomId)).toHaveLength(20);
  });

  it("退出後の再参加は元の色を使い、通算上限を消費しない", async () => {
    const roomId = "room-member-color-rejoin";
    const stub = roomStub(roomId);
    const firstUserId = userIdAt(1);

    await expect(stub.upsertMember(firstUserId, "Member 1")).resolves.toEqual({
      ok: true,
    });
    const firstColor = (await stub.listMembers())[0]?.color;
    await stub.leave(firstUserId);
    await expect(stub.upsertMember(firstUserId, "Member 1")).resolves.toEqual({
      ok: true,
    });
    expect((await stub.listMembers())[0]?.color).toBe(firstColor);
  });
});

describe("RoomDO 進行状態", () => {
  it("getPhase のデフォルトは lobby（または room_state 既定の phase1 を getPhase が返す）", async () => {
    // マイグレーション v2 の既定は phase1。新規ルームは initializeNewRoom で lobby にする。
    const stub = roomStub("room-phase-default");
    await stub.initializeNewRoom(USER_A, "Host");
    expect(await stub.getPhase()).toBe("lobby");
  });

  it("setPhase は phase を更新する（ホスト本人のみ）", async () => {
    const stub = roomStub("room-phase-set");
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase("phase1", USER_A);
    expect(await stub.getPhase()).toBe("phase1");
  });

  it("setPhase は room_owner のホスト以外なら reject（二重防御）", async () => {
    // setPhase は async 関数で throw するため、rejects で受ける。
    // runInDurableObject 経由にすれば unhandled rejection として漏れない。
    await runInRoomDO("room-phase-guard", async (instance) => {
      await instance.initializeNewRoom(USER_A, "Host");
      await expect(instance.setPhase("phase1", USER_B)).rejects.toThrow(
        "進行状態を変更する権限がありません。",
      );
    });
    // 状態は lobby / 既定のまま
    const stub = roomStub("room-phase-guard");
    expect(await stub.getPhase()).not.toBe("phase2");
  });
});

describe("RoomDO 解散", () => {
  it("disband はストレージを完全に空にする（schema_migrations 含む）", async () => {
    const roomId = "room-disband-empty";
    const stub = roomStub(roomId);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    expect(await listMemberIds(roomId)).toEqual([USER_A, USER_B]);

    await stub.disband();

    // deleteAll 後はテーブル自体が消える。listMembers RPC は使わず storage を直接見る。
    await runInRoomDO(roomId, (_instance, state) => {
      const tables = state.storage.sql
        .exec(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .toArray()
        .map((row) => String(row.name));
      expect(tables).toEqual([]);
    });
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

  it("HOST_ID_HEADER なしの upgrade は 403", async () => {
    const stub = roomStub("room-guard-no-host");
    await stub.upsertMember(USER_A, "Alpha");
    const res = await stub.fetch("https://do/ws", {
      headers: { Upgrade: "websocket", [USER_ID_HEADER]: USER_A },
    });
    expect(res.status).toBe(403);
  });

  it("非メンバーのユーザーIDでの upgrade は 403", async () => {
    const res = await roomStub("room-guard").fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_B,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    expect(res.status).toBe(403);
  });

  it("メンバーのユーザーID + hostId ヘッダーでの upgrade は 101", async () => {
    const stub = roomStub("room-guard-member");
    await stub.upsertMember(USER_A, "Alpha");
    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    expect(res.status).toBe(101);
    res.webSocket?.accept();
    res.webSocket?.close();
  });

  it("非ホストは自分を HOST_ID_HEADER に指定しても start_phase できない", async () => {
    const roomId = "room-guard-forged-host-start";
    const stub = roomStub(roomId);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");

    const ws = await connectDirectly(roomId, USER_B, USER_B);
    ws.send(JSON.stringify({ type: "start_phase" }));

    await expect(nextJson(ws)).resolves.toMatchObject({
      type: "error",
      code: "forbidden",
    });
    expect(await stub.getPhase()).toBe("lobby");
    ws.close();
  });

  it("非ホストは自分を HOST_ID_HEADER に指定しても phase:next できない", async () => {
    const roomId = "room-guard-forged-host-next";
    const stub = roomStub(roomId);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase("phase1", USER_A);

    const ws = await connectDirectly(roomId, USER_B, USER_B);
    ws.send(JSON.stringify({ type: "phase:next" }));

    await expect(nextJson(ws)).resolves.toMatchObject({
      type: "error",
      code: "forbidden",
    });
    expect(await stub.getPhase()).toBe("phase1");
    ws.close();
  });
});

// start_phase の認可は WebSocket 経由の room-protocol.spec.ts で検証する
// （ホストだけ phase:updated が届くこと、非ホストは forbidden で拒否されること）。

describe("RoomDO snapshot", () => {
  it("host は snapshot で isHost=true になる", async () => {
    const stub = roomStub("room-snapshot-host");

    await stub.initializeNewRoom(USER_A, "Host");

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });

    expect(res.status).toBe(101);

    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();

    const message = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve);
    });

    const snapshot = JSON.parse(String(message.data));

    expect(snapshot.type).toBe("snapshot");
    expect(snapshot.isHost).toBe(true);
    expect(snapshot.members).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: USER_A })]),
    );

    ws.close();
  });

  it("member は snapshot で isHost=false になる", async () => {
    const stub = roomStub("room-snapshot-member");

    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_B,
        [HOST_ID_HEADER]: USER_A,
      },
    });

    expect(res.status).toBe(101);

    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();

    const message = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve);
    });

    const snapshot = JSON.parse(String(message.data));

    expect(snapshot.type).toBe("snapshot");
    expect(snapshot.isHost).toBe(false);

    ws.close();
  });
});

describe("RoomDO phase:next", () => {
  it("全参加者の主観・客観投票が完了するまで phase3 を終了できない", async () => {
    const stub = roomStub("room-phase-voting-incomplete");
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase("phase3", USER_A);

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    ws.send(JSON.stringify({ type: "phase:next" }));
    const message = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    expect(JSON.parse(String(message.data))).toMatchObject({
      type: "error",
      code: "forbidden",
    });
    expect(await stub.getPhase()).toBe("phase3");
    ws.close();
  });

  it("host は phase を進められる", async () => {
    const stub = roomStub("room-phase-host");

    await stub.initializeNewRoom(USER_A, "Host");
    // 既定 phase1 のまま phase:next → phase2
    await stub.setPhase("phase1", USER_A);

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });

    expect(res.status).toBe(101);

    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();

    // snapshot を捨てる
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    ws.send(JSON.stringify({ type: "phase:next" }));

    const message = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    const body = JSON.parse(String(message.data));

    expect(body.type).toBe("phase:updated");
    expect(body.phase).toBe("phase2");

    ws.close();
  });

  it("member は phase を進められない", async () => {
    const stub = roomStub("room-phase-member");

    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase("phase1", USER_A);

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_B,
        [HOST_ID_HEADER]: USER_A,
      },
    });

    expect(res.status).toBe(101);

    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();

    // snapshot を捨てる
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    ws.send(JSON.stringify({ type: "phase:next" }));

    const message = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    const error = JSON.parse(String(message.data));

    expect(error.type).toBe("error");
    expect(error.code).toBe("forbidden");

    ws.close();
  });

  it("phase 更新は全クライアントへ配信される", async () => {
    const stub = roomStub("room-phase-broadcast");

    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase("phase1", USER_A);

    const hostRes = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });

    const memberRes = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_B,
        [HOST_ID_HEADER]: USER_A,
      },
    });

    expect(hostRes.status).toBe(101);
    expect(memberRes.status).toBe(101);

    const host = hostRes.webSocket;
    const member = memberRes.webSocket;
    if (!host || !member) {
      throw new Error("WebSocket 接続を確立できませんでした。");
    }

    host.accept();
    member.accept();

    // snapshot を受け取る
    await Promise.all([
      new Promise<MessageEvent>((resolve) => {
        host.addEventListener("message", resolve, { once: true });
      }),
      new Promise<MessageEvent>((resolve) => {
        member.addEventListener("message", resolve, { once: true });
      }),
    ]);

    // 各クライアントは phase:updated の1通を受ける
    const collectOne = (ws: WebSocket) =>
      new Promise<unknown>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          ws.removeEventListener("message", onMessage);
          resolve(JSON.parse(String(event.data)));
        };
        ws.addEventListener("message", onMessage);
      });

    const hostPromise = collectOne(host);
    const memberPromise = collectOne(member);

    host.send(JSON.stringify({ type: "phase:next" }));

    const [hostMessage, memberMessage] = await Promise.all([
      hostPromise,
      memberPromise,
    ]);

    for (const msg of [hostMessage, memberMessage]) {
      expect((msg as { type: string }).type).toBe("phase:updated");
      expect((msg as { phase: string }).phase).toBe("phase2");
    }

    host.close();
    member.close();
  });
});

describe("RoomDO phase4 のボード凍結", () => {
  it("phase4 では非公開付箋を公開できない", async () => {
    const stub = roomStub("room-phase4-publish-freeze");
    await stub.initializeNewRoom(USER_A, "Host");

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    ws.send(JSON.stringify({ type: "note:create" }));
    const insertedEvent = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    const inserted = JSON.parse(String(insertedEvent.data)) as {
      type: string;
      note: { id: string };
    };
    expect(inserted.type).toBe("note:inserted");

    await stub.setPhase("phase4", USER_A);
    ws.send(
      JSON.stringify({
        type: "note:publish",
        noteId: inserted.note.id,
        x: 100,
        y: 100,
      }),
    );

    const errorEvent = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    expect(JSON.parse(String(errorEvent.data))).toMatchObject({
      type: "error",
      code: "forbidden",
    });

    ws.close();
  });

  it("phase4 では共有付箋を非公開に戻せない", async () => {
    const stub = roomStub("room-phase4-unpublish-freeze");
    await stub.initializeNewRoom(USER_A, "Host");

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    ws.send(JSON.stringify({ type: "note:create" }));
    const draftEvent = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    const draft = JSON.parse(String(draftEvent.data)) as {
      note: { id: string };
    };

    ws.send(
      JSON.stringify({
        type: "note:publish",
        noteId: draft.note.id,
        x: 100,
        y: 100,
      }),
    );
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    await stub.setPhase("phase4", USER_A);
    ws.send(JSON.stringify({ type: "note:unpublish", noteId: draft.note.id }));

    const errorEvent = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    expect(JSON.parse(String(errorEvent.data))).toMatchObject({
      type: "error",
      code: "forbidden",
    });

    ws.close();
  });

  it("phase4 では WebSocket からの付箋本文更新を拒否し、付箋内容を維持する", async () => {
    const stub = roomStub("room-phase4-freeze");
    await stub.initializeNewRoom(USER_A, "Host");

    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    ws.send(JSON.stringify({ type: "note:create" }));
    const insertedEvent = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    const inserted = JSON.parse(String(insertedEvent.data)) as {
      type: string;
      note: { id: string; content: string };
    };
    expect(inserted.type).toBe("note:inserted");

    await stub.setPhase("phase4", USER_A);
    ws.send(
      JSON.stringify({
        type: "note:update-content",
        noteId: inserted.note.id,
        content: "phase4 中の書き換え",
      }),
    );

    const errorEvent = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    expect(JSON.parse(String(errorEvent.data))).toMatchObject({
      type: "error",
      code: "forbidden",
    });

    ws.close();
  });
});

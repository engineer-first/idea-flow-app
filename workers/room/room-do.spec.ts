// RoomDO 単体の契約テスト。
// メンバーシップの真実（upsert の冪等性・isMember 判定・name の保持・進行状態）と、
// api-worker を経由しない到達への深層防御を検証する。
// Realtime 配信（新規メンバーの member_joined broadcast）は
// room-protocol.spec.ts の E2E テスト（実 WS 接続）で検証する。
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { buildLobbyPhase, buildPhaseStep } from "../../contracts/phase.fixture";
import {
  NOTE_COLOR_PALETTE,
  TIMER_MAX_DURATION_MS,
} from "../../contracts/room-protocol";
import { listMemberIds, runInRoomDO } from "../test-helpers";
import { HOST_ID_HEADER, USER_ID_HEADER } from "./room-do";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const NOTE_COLOR_PATTERN = new RegExp(`^(${NOTE_COLOR_PALETTE.join("|")})$`);
const LOBBY = buildLobbyPhase();

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
  it("getPhase の新規ルーム既定は lobby", async () => {
    // マイグレーション v2 の既定は phase1。新規ルームは initializeNewRoom で lobby にする。
    const stub = roomStub("room-phase-default");
    await stub.initializeNewRoom(USER_A, "Host");
    expect(await stub.getPhase()).toEqual(LOBBY);
  });

  it("setPhase は phase を更新する（ホスト本人のみ）", async () => {
    const stub = roomStub("room-phase-set");
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase(buildPhaseStep(1), USER_A);
    expect(await stub.getPhase()).toEqual(buildPhaseStep(1));
  });

  it.each([
    buildPhaseStep(3, 2),
    buildPhaseStep(5, 3),
  ])("フェーズ2・3の保存済み進行状態を復元する: %o", async (phase) => {
    const stub = roomStub(`room-phase-roundtrip-${phase.phase}-${phase.step}`);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase(phase, USER_A);

    expect(await stub.getPhase()).toEqual(phase);
  });

  it("setPhase は room_owner のホスト以外なら reject（二重防御）", async () => {
    // setPhase は async 関数で throw するため、rejects で受ける。
    // runInDurableObject 経由にすれば unhandled rejection として漏れない。
    await runInRoomDO("room-phase-guard", async (instance) => {
      await instance.initializeNewRoom(USER_A, "Host");
      await expect(
        instance.setPhase(buildPhaseStep(1), USER_B),
      ).rejects.toThrow("進行状態を変更する権限がありません。");
    });
    // 状態は lobby / 既定のまま
    const stub = roomStub("room-phase-guard");
    expect(await stub.getPhase()).toEqual(LOBBY);
  });

  it.each([
    ["phase1-step1", buildPhaseStep(1)],
    ["phase2-step1", buildPhaseStep(1, 2)],
    ["phase2-step3", buildPhaseStep(3, 2)],
    ["phase3-step5", buildPhaseStep(5, 3)],
  ])("保存済みの有効な phase=%s を %o として復元する", async (raw, expected) => {
    const roomId = `room-phase-decode-${raw}`;
    const stub = roomStub(roomId);
    await stub.initializeNewRoom(USER_A, "Host");
    await runInRoomDO(roomId, (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE room_state SET phase = ?1 WHERE id = 1",
        raw,
      );
    });

    expect(await stub.getPhase()).toEqual(expected);
  });

  // 旧フラット形式（writing / phase1..4）は migration
  // normalize-legacy-phase-values が保存形式ごと正規化する。decode は
  // 正規形式だけを解釈し、それ以外は lobby へ fail-safe する。
  it.each([
    ["garbage", buildLobbyPhase()],
    ["writing", buildLobbyPhase()],
    ["phase2", buildLobbyPhase()],
    ["phase1-step9", buildLobbyPhase()],
    ["phase2-step5", buildLobbyPhase()],
    ["phase3-step6", buildLobbyPhase()],
    ["phase4-step1", buildLobbyPhase()],
  ])("保存済みの無効な phase=%s を %o として復元する", async (raw, expected) => {
    const roomId = `room-phase-decode-${raw}`;
    const stub = roomStub(roomId);
    await stub.initializeNewRoom(USER_A, "Host");
    await runInRoomDO(roomId, (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE room_state SET phase = ?1 WHERE id = 1",
        raw,
      );
    });

    expect(await stub.getPhase()).toEqual(expected);
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
    expect(await stub.getPhase()).toEqual(LOBBY);
    ws.close();
  });

  it("非ホストは自分を HOST_ID_HEADER に指定しても phase:next できない", async () => {
    const roomId = "room-guard-forged-host-next";
    const stub = roomStub(roomId);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase(buildPhaseStep(1), USER_A);

    const ws = await connectDirectly(roomId, USER_B, USER_B);
    ws.send(JSON.stringify({ type: "phase:next" }));

    await expect(nextJson(ws)).resolves.toMatchObject({
      type: "error",
      code: "forbidden",
    });
    expect(await stub.getPhase()).toEqual(buildPhaseStep(1));
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
  it("全参加者の主観・客観投票が完了するまで Step 1-4 を終了できない", async () => {
    const stub = roomStub("room-phase-voting-incomplete");
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase(buildPhaseStep(4), USER_A);

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

    // 投票未完了によるゲート拒否は voting-incomplete。クライアントは
    // このコードでホストへ「強制的に進むか」の確認を出す。
    expect(JSON.parse(String(message.data))).toMatchObject({
      type: "error",
      code: "voting-incomplete",
    });
    expect(await stub.getPhase()).toEqual(buildPhaseStep(4));
    ws.close();
  });

  it("未投票メンバーが残っていても、ホストは force で Step 1-5 へ進められる", async () => {
    const roomName = "room-phase-force-next";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase(buildPhaseStep(4), USER_A);

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify({ type: "phase:next", force: true }));

    expect(await nextJson(ws)).toMatchObject({
      type: "phase:updated",
      phase: buildPhaseStep(5),
    });
    expect(await stub.getPhase()).toEqual(buildPhaseStep(5));
    ws.close();
  });

  it("ホスト以外は force を付けても phase を進められない", async () => {
    const roomName = "room-phase-force-non-host";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase(buildPhaseStep(4), USER_A);

    const ws = await connectDirectly(roomName, USER_B, USER_A);
    ws.send(JSON.stringify({ type: "phase:next", force: true }));

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
    });
    expect(await stub.getPhase()).toEqual(buildPhaseStep(4));
    ws.close();
  });

  it("lobby では force を付けても phase:next できない", async () => {
    const roomName = "room-phase-force-lobby";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify({ type: "phase:next", force: true }));

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
    });
    expect(await stub.getPhase()).toEqual(LOBBY);
    ws.close();
  });

  it("全員の投票が完了していれば force なしで Step 1-5 へ進める", async () => {
    const roomName = "room-phase-voting-complete";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase(buildPhaseStep(4), USER_A);
    // 全員が主観1票・客観3票をちょうど使い切った状態を直接作る。
    await runInRoomDO(roomName, (_instance, state) => {
      const now = new Date().toISOString();
      for (const userId of [USER_A, USER_B]) {
        state.storage.sql.exec(
          `INSERT INTO note_votes (note_id, user_id, kind, created_at, vote_count)
           VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ?1, 'subjective', ?2, 1),
                  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ?1, 'objective', ?2, 3)`,
          userId,
          now,
        );
      }
    });

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify({ type: "phase:next" }));

    expect(await nextJson(ws)).toMatchObject({
      type: "phase:updated",
      phase: buildPhaseStep(5),
    });
    ws.close();
  });

  it("host は phase を進められる", async () => {
    const stub = roomStub("room-phase-host");

    await stub.initializeNewRoom(USER_A, "Host");
    // Step 1-1 のまま phase:next → Step 1-2
    await stub.setPhase(buildPhaseStep(1), USER_A);

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
    expect(body.phase).toEqual(buildPhaseStep(2));

    ws.close();
  });

  it("member は phase を進められない", async () => {
    const stub = roomStub("room-phase-member");

    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    await stub.setPhase(buildPhaseStep(1), USER_A);

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
    await stub.setPhase(buildPhaseStep(1), USER_A);

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
      expect((msg as { phase: unknown }).phase).toEqual(buildPhaseStep(2));
    }

    host.close();
    member.close();
  });
});

describe("RoomDO timer:* の認可", () => {
  it.each([
    { type: "timer:start", durationMs: 60_000 },
    { type: "timer:pause" },
    { type: "timer:resume" },
    { type: "timer:extend" },
    { type: "timer:stop" },
  ])("非ホストの $type は forbidden で状態を変更できない", async (command) => {
    const roomId = `room-timer-member-${command.type}`;
    const stub = roomStub(roomId);
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
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    ws.send(JSON.stringify(command));
    const event = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });

    expect(JSON.parse(String(event.data))).toMatchObject({
      type: "error",
      code: "forbidden",
    });
    ws.close();
  });

  it("D1由来 hostId が本人でも RoomDO の所有者でなければ操作できない", async () => {
    const stub = roomStub("room-timer-forged-host-header");
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.upsertMember(USER_B, "Member");
    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_B,
        [HOST_ID_HEADER]: USER_B,
      },
    });
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    ws.send(JSON.stringify({ type: "timer:start", durationMs: 60_000 }));
    const event = await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    expect(JSON.parse(String(event.data))).toMatchObject({
      type: "error",
      code: "forbidden",
    });
    ws.close();
  });

  it("ホストでも現在状態に合わない操作は権限エラーと異なる文言で拒否する", async () => {
    const stub = roomStub("room-timer-invalid-state");
    await stub.initializeNewRoom(USER_A, "Host");
    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    const receive = () =>
      new Promise<Record<string, unknown>>((resolve) => {
        ws.addEventListener(
          "message",
          (event) => resolve(JSON.parse(String(event.data))),
          { once: true },
        );
      });
    await receive();

    ws.send(JSON.stringify({ type: "timer:pause" }));
    expect(await receive()).toMatchObject({
      type: "error",
      code: "forbidden",
      message: "この状態ではその操作はできません。",
    });

    ws.send(JSON.stringify({ type: "timer:start", durationMs: 60_000 }));
    await receive();
    ws.send(JSON.stringify({ type: "timer:start", durationMs: 30_000 }));
    expect(await receive()).toMatchObject({
      type: "error",
      code: "forbidden",
      message: "この状態ではその操作はできません。",
    });
    ws.close();
  });

  it("実行中・一時停止中の延長を 99:59 にクランプする", async () => {
    const stub = roomStub("room-timer-extend-limit");
    await stub.initializeNewRoom(USER_A, "Host");
    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    const receive = () =>
      new Promise<Record<string, unknown>>((resolve) => {
        ws.addEventListener(
          "message",
          (event) => resolve(JSON.parse(String(event.data))),
          { once: true },
        );
      });
    await receive();
    ws.send(
      JSON.stringify({
        type: "timer:start",
        durationMs: TIMER_MAX_DURATION_MS - 30_000,
      }),
    );
    const started = await receive();
    ws.send(JSON.stringify({ type: "timer:extend" }));
    const extended = await receive();
    expect(extended).toMatchObject({
      type: "timer:updated",
      timer: { status: "running", durationMs: TIMER_MAX_DURATION_MS },
    });
    expect((extended.timer as { endsAt: number }).endsAt).toBe(
      (started.timer as { endsAt: number }).endsAt + 30_000,
    );

    ws.send(JSON.stringify({ type: "timer:stop" }));
    await receive();
    ws.send(
      JSON.stringify({
        type: "timer:start",
        durationMs: TIMER_MAX_DURATION_MS - 30_000,
      }),
    );
    await receive();
    ws.send(JSON.stringify({ type: "timer:pause" }));
    const paused = await receive();
    ws.send(JSON.stringify({ type: "timer:extend" }));
    const extendedPaused = await receive();
    expect(extendedPaused).toMatchObject({
      type: "timer:updated",
      timer: { status: "paused", durationMs: TIMER_MAX_DURATION_MS },
    });
    expect((extendedPaused.timer as { remainingMs: number }).remainingMs).toBe(
      (paused.timer as { remainingMs: number }).remainingMs + 30_000,
    );
    ws.close();
  });

  it("idle への stop は状態変化も配信も行わない", async () => {
    const stub = roomStub("room-timer-stop-idle");
    await stub.initializeNewRoom(USER_A, "Host");
    const res = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    const ws = res.webSocket;
    if (!ws) throw new Error("WebSocket 接続を確立できませんでした。");
    ws.accept();
    await new Promise<MessageEvent>((resolve) => {
      ws.addEventListener("message", resolve, { once: true });
    });
    const messages: unknown[] = [];
    ws.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)));
    });
    ws.send(JSON.stringify({ type: "timer:stop" }));
    expect(await stub.getTimerState()).toEqual({ status: "idle" });
    expect(messages).toEqual([]);
    ws.close();
  });

  it("ホスト操作を状態変化時だけ配信し、停止後は idle を snapshot で復元する", async () => {
    const roomId = "room-timer-host-lifecycle";
    const stub = roomStub(roomId);
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
    const receive = () =>
      new Promise<Record<string, unknown>>((resolve) => {
        ws.addEventListener(
          "message",
          (event) => resolve(JSON.parse(String(event.data))),
          { once: true },
        );
      });
    await receive();

    const beforeStart = Date.now();
    ws.send(JSON.stringify({ type: "timer:start", durationMs: 60_000 }));
    const started = await receive();
    expect(started).toMatchObject({
      type: "timer:updated",
      timer: { status: "running", durationMs: 60_000 },
    });
    expect(
      Number((started.timer as { endsAt: number }).endsAt),
    ).toBeGreaterThanOrEqual(beforeStart + 60_000);

    ws.send(JSON.stringify({ type: "timer:pause" }));
    expect(await receive()).toMatchObject({
      type: "timer:updated",
      timer: { status: "paused", durationMs: 60_000 },
    });

    ws.send(JSON.stringify({ type: "timer:extend" }));
    expect(await receive()).toMatchObject({
      type: "timer:updated",
      timer: { status: "paused", durationMs: 120_000 },
    });

    ws.send(JSON.stringify({ type: "timer:resume" }));
    expect(await receive()).toMatchObject({
      type: "timer:updated",
      timer: { status: "running", durationMs: 120_000 },
    });

    ws.send(JSON.stringify({ type: "timer:stop" }));
    expect(await receive()).toMatchObject({
      type: "timer:updated",
      timer: { status: "idle" },
    });
    expect(await stub.getTimerState()).toEqual({ status: "idle" });
    ws.close();

    const reconnect = await stub.fetch("https://do/ws", {
      headers: {
        Upgrade: "websocket",
        [USER_ID_HEADER]: USER_A,
        [HOST_ID_HEADER]: USER_A,
      },
    });
    const reconnectWs = reconnect.webSocket;
    if (!reconnectWs) throw new Error("再接続できませんでした。");
    reconnectWs.accept();
    const snapshot = await new Promise<Record<string, unknown>>((resolve) => {
      reconnectWs.addEventListener(
        "message",
        (event) => resolve(JSON.parse(String(event.data))),
        { once: true },
      );
    });
    expect(snapshot).toMatchObject({
      type: "snapshot",
      timer: { status: "idle" },
    });
    expect(snapshot.serverNow).toEqual(expect.any(Number));
    reconnectWs.close();
  });
});

describe("RoomDO 課題整理ステップの境界ゲート", () => {
  it("フェーズ2では変更系メッセージをdeny-allで拒否する", async () => {
    const roomName = "room-phase-2-deny-all";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase(buildPhaseStep(1, 2), USER_A);

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify({ type: "note:create" }));

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
      message: expect.stringContaining("2-1 HMW作成"),
    });
    ws.close();
  });

  it("Step 1-1 では note:vote を付箋の存在確認より前に forbidden で拒否する", async () => {
    const roomName = "room-step-1-1-vote-forbidden";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify({ type: "start_phase" }));

    expect(await nextJson(ws)).toMatchObject({
      type: "phase:updated",
      phase: buildPhaseStep(1),
    });

    ws.send(
      JSON.stringify({
        type: "note:vote",
        noteId: "99999999-9999-4999-8999-999999999999",
        kind: "subjective",
      }),
    );

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
      message: expect.stringContaining("1-1 個人で書く"),
    });
    ws.close();
  });

  it.each([
    {
      step: 1,
      label: "1-1 個人で書く",
      operation: "note:publish",
      message: {
        type: "note:publish",
        noteId: "99999999-9999-4999-8999-999999999999",
        x: 100,
        y: 100,
      },
    },
    {
      step: 1,
      label: "1-1 個人で書く",
      operation: "note:move",
      message: {
        type: "note:move",
        noteId: "99999999-9999-4999-8999-999999999999",
        x: 100,
        y: 100,
      },
    },
    {
      step: 1,
      label: "1-1 個人で書く",
      operation: "group:create",
      message: {
        type: "group:create",
        group: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "未許可グループ",
          noteIds: [
            "99999999-9999-4999-8999-999999999999",
            "88888888-8888-4888-8888-888888888888",
          ],
          createdAt: "2026-07-15T00:00:00.000Z",
          updatedAt: "2026-07-15T00:00:00.000Z",
        },
      },
    },
    {
      step: 2,
      label: "1-2 共有する",
      operation: "note:create",
      message: { type: "note:create" },
    },
    {
      step: 2,
      label: "1-2 共有する",
      operation: "note:vote",
      message: {
        type: "note:vote",
        noteId: "99999999-9999-4999-8999-999999999999",
        kind: "subjective",
      },
    },
    {
      step: 2,
      label: "1-2 共有する",
      operation: "group:create",
      message: {
        type: "group:create",
        group: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "未許可グループ",
          noteIds: [
            "99999999-9999-4999-8999-999999999999",
            "88888888-8888-4888-8888-888888888888",
          ],
          createdAt: "2026-07-15T00:00:00.000Z",
          updatedAt: "2026-07-15T00:00:00.000Z",
        },
      },
    },
    {
      step: 3,
      label: "1-3 グループ化",
      operation: "note:create",
      message: { type: "note:create" },
    },
    {
      step: 3,
      label: "1-3 グループ化",
      operation: "note:vote",
      message: {
        type: "note:vote",
        noteId: "99999999-9999-4999-8999-999999999999",
        kind: "subjective",
      },
    },
    {
      step: 4,
      label: "1-4 ステルス投票",
      operation: "note:create",
      message: { type: "note:create" },
    },
    {
      step: 4,
      label: "1-4 ステルス投票",
      operation: "note:move",
      message: {
        type: "note:move",
        noteId: "99999999-9999-4999-8999-999999999999",
        x: 100,
        y: 100,
      },
    },
    {
      step: 4,
      label: "1-4 ステルス投票",
      operation: "note:drag",
      message: {
        type: "note:drag",
        noteId: "99999999-9999-4999-8999-999999999999",
        x: 100,
        y: 100,
      },
    },
    {
      step: 4,
      label: "1-4 ステルス投票",
      operation: "group:update-name",
      message: {
        type: "group:update-name",
        groupId: "99999999-9999-4999-8999-999999999999",
        name: "未許可の更新",
      },
    },
    {
      step: 4,
      label: "1-4 ステルス投票",
      operation: "group:create",
      message: {
        type: "group:create",
        group: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "未許可グループ",
          noteIds: [
            "99999999-9999-4999-8999-999999999999",
            "88888888-8888-4888-8888-888888888888",
          ],
          createdAt: "2026-07-15T00:00:00.000Z",
          updatedAt: "2026-07-15T00:00:00.000Z",
        },
      },
    },
  ])("Step 1-$step では $operation を個別ハンドラより前に拒否する", async ({
    step,
    label,
    operation,
    message,
  }) => {
    const roomName = `room-step-gate-${step}-${operation}`;
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase(buildPhaseStep(step), USER_A);

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify(message));

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
      message: expect.stringContaining(label),
    });
    ws.close();
  });

  it.each([
    { type: "note:create" },
    {
      type: "note:publish",
      noteId: "99999999-9999-4999-8999-999999999999",
      x: 100,
      y: 100,
    },
    {
      type: "note:unpublish",
      noteId: "99999999-9999-4999-8999-999999999999",
    },
    {
      type: "note:update-content",
      noteId: "99999999-9999-4999-8999-999999999999",
      content: "拒否される更新",
    },
    {
      type: "note:move",
      noteId: "99999999-9999-4999-8999-999999999999",
      x: 100,
      y: 100,
    },
    {
      type: "note:drag",
      noteId: "99999999-9999-4999-8999-999999999999",
      x: 100,
      y: 100,
    },
    {
      type: "note:delete",
      noteId: "99999999-9999-4999-8999-999999999999",
    },
    {
      type: "note:vote",
      noteId: "99999999-9999-4999-8999-999999999999",
      kind: "subjective",
    },
    {
      type: "note:vote-reset",
      noteId: "99999999-9999-4999-8999-999999999999",
      kind: "subjective",
    },
    {
      type: "group:create",
      group: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "未許可グループ",
        noteIds: [
          "99999999-9999-4999-8999-999999999999",
          "88888888-8888-4888-8888-888888888888",
        ],
        createdAt: "2026-07-15T00:00:00.000Z",
        updatedAt: "2026-07-15T00:00:00.000Z",
      },
    },
    {
      type: "group:update-name",
      groupId: "99999999-9999-4999-8999-999999999999",
      name: "未許可の更新",
    },
  ])("Step 1-5 では変更操作 $type を拒否する", async (message) => {
    const roomName = `room-step-5-${message.type}`;
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase(buildPhaseStep(5), USER_A);

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify(message));

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
      message: expect.stringContaining("1-5 結果集計・絞り込み"),
    });
    ws.close();
  });
});

describe("RoomDO Step 1-5 のボード凍結", () => {
  it("Step 1-5 では非公開付箋を公開できない", async () => {
    const stub = roomStub("room-phase4-publish-freeze");
    await stub.initializeNewRoom(USER_A, "Host");
    // lobby のままでは付箋を作れないため、ボード工程に進めてから凍結を検証する。
    await stub.setPhase(buildPhaseStep(1), USER_A);

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

    await stub.setPhase(buildPhaseStep(5), USER_A);
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

  it("Step 1-5 では共有付箋を非公開に戻せない", async () => {
    const stub = roomStub("room-phase4-unpublish-freeze");
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase(buildPhaseStep(1), USER_A);

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

    await stub.setPhase(buildPhaseStep(5), USER_A);
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

  it("Step 1-5 では WebSocket からの付箋本文更新を拒否し、付箋内容を維持する", async () => {
    const stub = roomStub("room-phase4-freeze");
    await stub.initializeNewRoom(USER_A, "Host");
    await stub.setPhase(buildPhaseStep(1), USER_A);

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

    await stub.setPhase(buildPhaseStep(5), USER_A);
    ws.send(
      JSON.stringify({
        type: "note:update-content",
        noteId: inserted.note.id,
        content: "Step 1-5 中の書き換え",
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

describe("RoomDO lobby のボード凍結", () => {
  it("lobby では note:create が拒否され、付箋は作成されない", async () => {
    const roomName = "room-lobby-create-freeze";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify({ type: "note:create" }));

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
    });
    const noteCount = await runInRoomDO(roomName, (_instance, state) => {
      return state.storage.sql.exec("SELECT COUNT(*) AS c FROM notes").one()
        .c as number;
    });
    expect(noteCount).toBe(0);

    ws.close();
  });

  it("lobby では note:vote が付箋の存在確認より前に境界で拒否される", async () => {
    const roomName = "room-lobby-vote-freeze";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(
      JSON.stringify({
        type: "note:vote",
        noteId: "99999999-9999-4999-8999-999999999999",
        kind: "subjective",
      }),
    );

    // not-found ではなく forbidden: ガードが個別処理より先に効いている。
    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
    });

    ws.close();
  });

  it("lobby では group:create が拒否され、グループは作成されない", async () => {
    const roomName = "room-lobby-group-freeze";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");

    // 共有付箋の検証（hasOnlySharedNotes）を通過する状態を直接作り、
    // 境界ガードがなければ group:create が成功してしまうことを保証する。
    const sharedNoteIds = [
      "77777777-7777-4777-8777-777777777777",
      "66666666-6666-4666-8666-666666666666",
    ];
    await runInRoomDO(roomName, (_instance, state) => {
      const now = new Date().toISOString();
      for (const noteId of sharedNoteIds) {
        state.storage.sql.exec(
          `INSERT INTO notes (id, author_id, content, visibility, color, x, y, created_at, updated_at)
           VALUES (?1, ?2, '', 'shared', 'yellow', 0, 0, ?3, ?3)`,
          noteId,
          USER_A,
          now,
        );
      }
    });

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    const now = new Date().toISOString();
    ws.send(
      JSON.stringify({
        type: "group:create",
        group: {
          id: "88888888-8888-4888-8888-888888888888",
          name: "lobby中のグループ",
          noteIds: sharedNoteIds,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    expect(await nextJson(ws)).toMatchObject({
      type: "error",
      code: "forbidden",
    });
    const groupCount = await runInRoomDO(roomName, (_instance, state) => {
      return state.storage.sql.exec("SELECT COUNT(*) AS c FROM groups").one()
        .c as number;
    });
    expect(groupCount).toBe(0);

    ws.close();
  });

  it("start_phase で Step 1-1 に進むと note:create が通る（凍結は lobby 限定）", async () => {
    const roomName = "room-lobby-unfreeze";
    const stub = roomStub(roomName);
    await stub.initializeNewRoom(USER_A, "Host");

    const ws = await connectDirectly(roomName, USER_A, USER_A);
    ws.send(JSON.stringify({ type: "start_phase" }));
    expect(await nextJson(ws)).toMatchObject({
      type: "phase:updated",
      phase: buildPhaseStep(1),
    });

    ws.send(JSON.stringify({ type: "note:create" }));
    expect(await nextJson(ws)).toMatchObject({ type: "note:inserted" });

    ws.close();
  });
});

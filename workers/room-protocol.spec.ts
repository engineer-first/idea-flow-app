// RoomDO の WebSocket プロトコルのテスト。
// Supabase 時代の pgTAP テストのうち付箋の認可仕様をプロトコル境界に移植した:
// - メンバーは他人の付箋の content / 位置を更新できる（共同編集）
// - author 以外は削除できない（forbidden エラー、付箋は残る）
// - authorId の書き換えは「そもそもメッセージが存在しない」ため構造的に不可能
//   （旧: 列レベル GRANT。update-content が authorId を変えないことをここで固定する）
//   なお roomId はプロトコルに現れない（note には含まれない）
// 加えて PoC の同期セマンティクスを検証する:
// - note:drag は永続化されず、送信者自身にはエコーされない
// - 再接続時は snapshot で現在状態へ復帰できる（R1 復帰パス）
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  NOTE_SPAWN_JITTER,
  NOTE_SPAWN_X_MIN,
  NOTE_SPAWN_Y_MIN,
} from "../contracts/board";
import {
  NOTE_COLOR_PALETTE,
  type ServerMessage,
} from "../contracts/room-protocol";
import {
  connectRoomAs,
  createRoomAs,
  joinRoomAs,
  type RoomSocket,
  runInRoomDO,
  sessionCookieFor,
  type TestUser,
} from "./test-helpers";

const OWNER: TestUser = {
  sub: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.test",
  name: "Owner",
};
const MEMBER: TestUser = {
  sub: "22222222-2222-4222-8222-222222222222",
  email: "member@example.test",
  name: "Member",
};
const NOTE_COLOR_PATTERN = new RegExp(`^(${NOTE_COLOR_PALETTE.join("|")})$`);

// 2ユーザーが同じルームに接続した状態を作る（snapshot 受信済み）。
async function setupRoom(): Promise<{
  roomId: string;
  owner: RoomSocket;
  member: RoomSocket;
}> {
  const { roomId, inviteCode } = await createRoomAs(OWNER);
  await joinRoomAs(MEMBER, inviteCode);

  const owner = await connectRoomAs(OWNER, roomId);
  const ownerSnapshot = await owner.next();
  expect(ownerSnapshot.type).toBe("snapshot");

  const member = await connectRoomAs(MEMBER, roomId);
  const memberSnapshot = await member.next();
  expect(memberSnapshot.type).toBe("snapshot");

  return { roomId, owner, member };
}

function send(socket: RoomSocket, message: unknown): void {
  socket.ws.send(JSON.stringify(message));
}

function storedHostId(roomId: string): Promise<string | null> {
  return runInRoomDO(roomId, (_instance, state) => {
    const row = state.storage.sql
      .exec("SELECT host_id FROM room_owner WHERE id = 1")
      .toArray()[0] as { host_id: string | null } | undefined;
    return row?.host_id ?? null;
  });
}

async function expectType<T extends ServerMessage["type"]>(
  socket: RoomSocket,
  type: T,
): Promise<Extract<ServerMessage, { type: T }>> {
  const message = await socket.next();
  expect(message.type).toBe(type);
  return message as Extract<ServerMessage, { type: T }>;
}

// owner の付箋を1枚作り、全接続がイベントを消化した状態にする。
async function createNote(room: {
  owner: RoomSocket;
  member: RoomSocket;
}): Promise<string> {
  send(room.owner, { type: "note:create" });
  const drafted = await expectType(room.owner, "note:inserted");
  expect(drafted.note.visibility).toBe("private");
  send(room.owner, {
    type: "note:publish",
    noteId: drafted.note.id,
    x: 100,
    y: 100,
  });
  await expectType(room.owner, "note:inserted");
  await expectType(room.member, "note:inserted");
  return drafted.note.id;
}

describe("snapshot（接続・再接続の復帰パス）", () => {
  it("接続直後に付箋一覧が届く（roomId はプロトコルに現れない）", async () => {
    const { roomId } = await createRoomAs(OWNER);
    const socket = await connectRoomAs(OWNER, roomId);
    const snapshot = await expectType(socket, "snapshot");

    expect(snapshot.notes).toEqual([]);
    expect(snapshot.members).toEqual([
      {
        userId: OWNER.sub,
        name: OWNER.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    ]);
    expect(snapshot.phase).toBe("lobby");
    expect(snapshot).not.toHaveProperty("room");
    expect(snapshot).not.toHaveProperty("self");
    socket.close();
  });

  it("再接続すると、切断中を含む全ての確定状態が snapshot に反映されている", async () => {
    const { roomId, owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    // owner が切断している間に member が本文と位置を確定する。
    owner.close();
    send(member, {
      type: "note:update-content",
      noteId,
      content: "切断中の更新",
    });
    await expectType(member, "note:updated");
    send(member, { type: "note:move", noteId, x: 640, y: 480 });
    await expectType(member, "note:updated");

    const reconnected = await connectRoomAs(OWNER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(snapshot.notes).toHaveLength(1);
    expect(snapshot.notes[0]).toMatchObject({
      id: noteId,
      content: "切断中の更新",
      x: 640,
      y: 480,
      authorId: OWNER.sub,
    });
    // members にも両方が居る（host 切断中も RoomDO の members は不変）
    expect(snapshot.members).toEqual([
      {
        userId: OWNER.sub,
        name: OWNER.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
      {
        userId: MEMBER.sub,
        name: MEMBER.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    ]);
    expect(snapshot.phase).toBe("lobby");

    reconnected.close();
    member.close();
  });

  it("切断中に start_phase が進んだあと再接続すると snapshot.phase が phase1 になる", async () => {
    const { roomId, owner, member } = await setupRoom();
    // member が切断している間に host が phase1 へ進める
    member.close();
    send(owner, { type: "start_phase" });
    await expectType(owner, "phase:updated");

    const reconnected = await connectRoomAs(MEMBER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(snapshot.phase).toBe("phase1");

    reconnected.close();
    owner.close();
  });
});

describe("メンバー色と付箋色", () => {
  it("6人までのメンバーには重複しない色を割り当て、付箋は作者の退出後もその色を保つ", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);
    const additionalMembers: TestUser[] = [
      {
        sub: "33333333-3333-4333-8333-333333333333",
        email: "member-3@example.test",
        name: "Member 3",
      },
      {
        sub: "44444444-4444-4444-8444-444444444444",
        email: "member-4@example.test",
        name: "Member 4",
      },
      {
        sub: "55555555-5555-4555-8555-555555555555",
        email: "member-5@example.test",
        name: "Member 5",
      },
      {
        sub: "66666666-6666-4666-8666-666666666666",
        email: "member-6@example.test",
        name: "Member 6",
      },
    ];
    for (const user of additionalMembers) {
      await joinRoomAs(user, inviteCode);
    }

    const member = await connectRoomAs(MEMBER, roomId);
    const memberSnapshot = await expectType(member, "snapshot");
    const colors = memberSnapshot.members.map((item) => item.color);
    expect(colors).toHaveLength(6);
    expect(new Set(colors).size).toBe(6);

    const memberColor = memberSnapshot.members.find(
      (item) => item.userId === MEMBER.sub,
    )?.color;
    expect(memberColor).toBeDefined();

    send(member, { type: "note:create" });
    const created = await expectType(member, "note:inserted");
    expect(created.note.color).toBe(memberColor);
    send(member, {
      type: "note:publish",
      noteId: created.note.id,
      x: 100,
      y: 100,
    });
    await expectType(member, "note:inserted");

    const leaveResponse = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/leave`,
      {
        method: "POST",
        headers: { Cookie: await sessionCookieFor(MEMBER) },
      },
    );
    expect(leaveResponse.status).toBe(204);

    const owner = await connectRoomAs(OWNER, roomId);
    const ownerSnapshot = await expectType(owner, "snapshot");
    expect(ownerSnapshot.members).not.toContainEqual(
      expect.objectContaining({ userId: MEMBER.sub }),
    );
    expect(ownerSnapshot.notes).toContainEqual(
      expect.objectContaining({ id: created.note.id, color: memberColor }),
    );

    owner.close();
    member.close();
  });
});

describe("member_joined（Realtime 反映）", () => {
  it("既存メンバー接続中に第三者が REST join すると、既存メンバー全員に member_joined が届く", async () => {
    // ホスト (owner) と参加者 (member) の WS が開いた状態で、第三者が
    // /api/rooms/join すると、RoomDO 内の upsertMember が両 WS に
    // member_joined を broadcast する（Realtime 反映）。
    const { roomId, owner, member } = await setupRoom();

    const newcomer: TestUser = {
      sub: "33333333-3333-4333-8333-333333333333",
      email: "newcomer@example.test",
      name: "Newcomer",
    };
    await joinRoomAs(newcomer, await getInviteCode(roomId, OWNER));

    // owner / member には member_joined が届く
    const toOwner = await expectType(owner, "member_joined");
    const toMember = await expectType(member, "member_joined");
    expect(toOwner).toEqual({
      type: "member_joined",
      member: {
        userId: newcomer.sub,
        name: newcomer.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    });
    expect(toMember).toEqual({
      type: "member_joined",
      member: {
        userId: newcomer.sub,
        name: newcomer.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    });

    owner.close();
    member.close();
  });

  it("第三者の新規メンバー本人の WS には member_joined が届かない（本人には snapshot.members が届く）", async () => {
    // newcomer の WS を open する直前に join 済みの場合、newcomer の
    // snapshot には自分も含めた全メンバーが含まれる。member_joined 自体は
    // 本人除外で送られない。
    const { roomId, owner, member } = await setupRoom();

    const newcomer: TestUser = {
      sub: "33333333-3333-4333-8333-333333333333",
      email: "newcomer@example.test",
      name: "Newcomer",
    };
    await joinRoomAs(newcomer, await getInviteCode(roomId, OWNER));

    // newcomer の WS を開く
    const newSocket = await connectRoomAs(newcomer, roomId);
    // 自分の snapshot.members には自分が含まれる
    const newcomerSnapshot = await expectType(newSocket, "snapshot");
    expect(newcomerSnapshot.members).toEqual([
      {
        userId: OWNER.sub,
        name: OWNER.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
      {
        userId: MEMBER.sub,
        name: MEMBER.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
      {
        userId: newcomer.sub,
        name: newcomer.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    ]);

    newSocket.close();
    owner.close();
    member.close();
  });

  it("既存メンバーが表示名を変更して再 join すると他クライアントへ member_joined が届く", async () => {
    const { roomId, owner, member } = await setupRoom();
    const renamedMember = { ...MEMBER, name: "Renamed Member" };

    await joinRoomAs(renamedMember, await getInviteCode(roomId, OWNER));
    const received = await Promise.race([
      owner.next(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 50)),
    ]);

    expect(received).toEqual({
      type: "member_joined",
      member: {
        userId: MEMBER.sub,
        name: renamedMember.name,
        color: expect.stringMatching(NOTE_COLOR_PATTERN),
      },
    });

    owner.close();
    member.close();
  });

  it("既存メンバーが同じ表示名で再 join しても member_joined は届かない", async () => {
    const { roomId, owner, member } = await setupRoom();
    const received: ServerMessage[] = [];
    owner.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.type === "member_joined") received.push(message);
    });

    await joinRoomAs(MEMBER, await getInviteCode(roomId, OWNER));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(received).toEqual([]);

    owner.close();
    member.close();
  });
});

describe("member_left（退出の Realtime 反映）", () => {
  it("既存メンバー接続中に REST leave すると、他メンバー全員に member_left が届く", async () => {
    const { roomId, owner } = await setupRoom();

    // member が REST で退出
    const leaveRes = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/leave`,
      { method: "POST", headers: { Cookie: await sessionCookieFor(MEMBER) } },
    );
    expect(leaveRes.status).toBe(204);

    // owner には member_left が届く
    const toOwner = await expectType(owner, "member_left");
    expect(toOwner).toEqual({ type: "member_left", userId: MEMBER.sub });
    owner.close();
  });

  it("退出した本人の WS はサーバ側で close される", async () => {
    const { roomId, owner, member } = await setupRoom();

    // member が REST で退出
    await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Cookie: await sessionCookieFor(MEMBER) },
    });

    // member の WS はサーバ側で close される。readyState は WebSocket.CLOSED (3)。
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(member.ws.readyState).toBe(3); // CLOSED
    owner.close();
  });

  it("退出後に同ユーザが再 join すると、既存メンバーに member_joined が届く", async () => {
    // 退出 → 再 join のシナリオで、broadcast が正しく動くことを確認。
    // （member_left と member_joined が両方届くことで「リアルタイム反映が
    // 生きている」ことを示す）
    const { roomId, owner, member } = await setupRoom();
    const membersBeforeLeave = await SELF.fetch(
      `https://api.test/api/rooms/${roomId}/members`,
      { headers: { Cookie: await sessionCookieFor(OWNER) } },
    );
    expect(membersBeforeLeave.status).toBe(200);
    const beforeLeaveBody = (await membersBeforeLeave.json()) as {
      members: Array<{ userId: string; color: string }>;
    };
    const colorBeforeLeave = beforeLeaveBody.members.find(
      (memberInfo) => memberInfo.userId === MEMBER.sub,
    )?.color;
    expect(colorBeforeLeave).toEqual(expect.stringMatching(NOTE_COLOR_PATTERN));

    // member 退出
    await SELF.fetch(`https://api.test/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { Cookie: await sessionCookieFor(MEMBER) },
    });
    await expectType(owner, "member_left");
    member.close();

    // member 再 join
    const rejoin = await SELF.fetch("https://api.test/api/rooms/join", {
      method: "POST",
      headers: {
        Cookie: await sessionCookieFor(MEMBER),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: await getInviteCode(roomId, OWNER) }),
    });
    expect(rejoin.status).toBe(200);

    // owner に member_joined が届く
    const reJoined = await expectType(owner, "member_joined");
    expect(reJoined.member).toEqual({
      userId: MEMBER.sub,
      name: MEMBER.name,
      color: colorBeforeLeave,
    });
    owner.close();
  });
});

describe("start_phase / phase:updated（ホストだけ進行状態を進められる）", () => {
  it("ホストが start_phase を送ると、phase:updated が全員に届く", async () => {
    const { owner, member } = await setupRoom();

    send(owner, { type: "start_phase" });
    const toOwner = await expectType(owner, "phase:updated");
    const toMember = await expectType(member, "phase:updated");
    expect(toOwner.phase).toBe("phase1");
    expect(toMember.phase).toBe("phase1");

    owner.close();
    member.close();
  });

  it("非ホストが start_phase を送ると forbidden で拒否され、phase:updated は誰にも届かない", async () => {
    const { roomId, owner, member } = await setupRoom();

    send(member, { type: "start_phase" });
    const error = await expectType(member, "error");
    expect(error.code).toBe("forbidden");

    // phase が変わっていないことを /api/rooms/[id] で検証する。
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
      headers: { Cookie: await sessionCookieFor(OWNER) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { phase: string };
    expect(body.phase).toBe("lobby");

    owner.close();
    member.close();
  });

  it("room_owner が NULL でも非ホストは start_phase できない", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);
    await runInRoomDO(roomId, (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE room_owner SET host_id = NULL WHERE id = 1",
      );
    });

    const member = await connectRoomAs(MEMBER, roomId);
    const snapshot = await expectType(member, "snapshot");
    expect(snapshot.isHost).toBe(false);

    send(member, { type: "start_phase" });
    const error = await expectType(member, "error");
    expect(error.code).toBe("forbidden");

    member.close();
  });

  it("room_owner が NULL でも非ホストは phase:next できない", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);
    await runInRoomDO(roomId, (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE room_owner SET host_id = NULL WHERE id = 1",
      );
      state.storage.sql.exec(
        "UPDATE room_state SET phase = 'phase1' WHERE id = 1",
      );
    });

    const member = await connectRoomAs(MEMBER, roomId);
    await expectType(member, "snapshot");

    send(member, { type: "phase:next" });
    const error = await expectType(member, "error");
    expect(error.code).toBe("forbidden");

    member.close();
  });

  it("room_owner が NULL の旧ルームへホストが接続するとバックフィルされ、開始できる", async () => {
    const { roomId } = await createRoomAs(OWNER);
    await runInRoomDO(roomId, (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE room_owner SET host_id = NULL WHERE id = 1",
      );
    });

    const owner = await connectRoomAs(OWNER, roomId);
    const snapshot = await expectType(owner, "snapshot");
    expect(snapshot.isHost).toBe(true);
    expect(await storedHostId(roomId)).toBe(OWNER.sub);

    send(owner, { type: "start_phase" });
    const updated = await expectType(owner, "phase:updated");
    expect(updated.phase).toBe("phase1");

    owner.close();
  });

  it("room_owner が NULL の旧ルームへ非ホストが先に接続しても D1 のホストでバックフィルする", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    await joinRoomAs(MEMBER, inviteCode);
    await runInRoomDO(roomId, (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE room_owner SET host_id = NULL WHERE id = 1",
      );
    });

    const member = await connectRoomAs(MEMBER, roomId);
    const memberSnapshot = await expectType(member, "snapshot");
    expect(memberSnapshot.isHost).toBe(false);
    expect(await storedHostId(roomId)).toBe(OWNER.sub);

    const owner = await connectRoomAs(OWNER, roomId);
    const ownerSnapshot = await expectType(owner, "snapshot");
    expect(ownerSnapshot.isHost).toBe(true);

    member.close();
    owner.close();
  });

  it("start_phase 後の phase は永続化され、再接続後の /api/rooms/[id] でも phase1 のまま", async () => {
    const { roomId, owner, member } = await setupRoom();

    send(owner, { type: "start_phase" });
    await expectType(owner, "phase:updated");
    await expectType(member, "phase:updated");
    owner.close();
    member.close();

    // 永続化されているか: 新規 WS 接続を開いて snapshot ではなく REST で phase を見る。
    const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
      headers: { Cookie: await sessionCookieFor(MEMBER) },
    });
    const body = (await res.json()) as { phase: string };
    expect(body.phase).toBe("phase1");
  });
});

// テスト用ヘルパー: ルーム ID / 招待コードを info 経由で取る。
async function getInviteCode(
  roomId: string,
  asUser: TestUser,
): Promise<string> {
  const res = await SELF.fetch(`https://api.test/api/rooms/${roomId}`, {
    headers: { Cookie: await sessionCookieFor(asUser) },
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { inviteCode: string }).inviteCode;
}

describe("note:create", () => {
  it("作成者だけにprivate付箋を配信し、公開後に全メンバーへ配信する", async () => {
    const { roomId, owner, member } = await setupRoom();

    send(owner, { type: "note:create" });
    const toOwner = await expectType(owner, "note:inserted");

    expect(toOwner.note.authorId).toBe(OWNER.sub);
    expect(toOwner.note.visibility).toBe("private");
    expect(toOwner.note).not.toHaveProperty("roomId");
    expect(toOwner.note.content).toBe("");
    // 個人付箋は再接続時も作者だけに復元される。
    member.close();
    const reconnected = await connectRoomAs(MEMBER, roomId);
    const privateSnapshot = await expectType(reconnected, "snapshot");
    expect(privateSnapshot.notes).toEqual([]);
    reconnected.close();

    // 新規付箋の初期座標は非公開でもサーバーで保持する。
    expect(toOwner.note.x).toBeGreaterThanOrEqual(NOTE_SPAWN_X_MIN);
    expect(toOwner.note.x).toBeLessThanOrEqual(
      NOTE_SPAWN_X_MIN + NOTE_SPAWN_JITTER,
    );
    expect(toOwner.note.y).toBeGreaterThanOrEqual(NOTE_SPAWN_Y_MIN);
    expect(toOwner.note.y).toBeLessThanOrEqual(
      NOTE_SPAWN_Y_MIN + NOTE_SPAWN_JITTER,
    );

    send(owner, {
      type: "note:publish",
      noteId: toOwner.note.id,
      x: 320,
      y: 240,
    });
    const publishedToOwner = await expectType(owner, "note:inserted");
    const memberAfterPublish = await connectRoomAs(MEMBER, roomId);
    const sharedSnapshot = await expectType(memberAfterPublish, "snapshot");
    expect(publishedToOwner.note.visibility).toBe("shared");
    expect(sharedSnapshot.notes).toMatchObject([
      { id: toOwner.note.id, x: 320, y: 240, visibility: "shared" },
    ]);

    owner.close();
    memberAfterPublish.close();
  });
});

describe("note:publish", () => {
  it("公開した付箋が既存グループに近ければ自動で加入する", async () => {
    const { owner, member } = await setupRoom();
    const firstNoteId = await createNote({ owner, member });
    const secondNoteId = await createNote({ owner, member });
    const groupId = "55555555-5555-4555-8555-555555555555";

    send(owner, {
      type: "group:create",
      group: {
        id: groupId,
        name: "既存グループ",
        noteIds: [firstNoteId, secondNoteId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    await expectType(owner, "group:updated");
    await expectType(member, "group:updated");

    send(owner, { type: "note:create" });
    const drafted = await expectType(owner, "note:inserted");

    send(owner, {
      type: "note:publish",
      noteId: drafted.note.id,
      x: 100,
      y: 100,
    });
    await expectType(owner, "note:inserted");
    await expectType(member, "note:inserted");
    const ownerGroupUpdate = await expectType(owner, "group:updated");
    const memberGroupUpdate = await expectType(member, "group:updated");

    expect(ownerGroupUpdate.group).toMatchObject({
      id: groupId,
      noteIds: expect.arrayContaining([
        firstNoteId,
        secondNoteId,
        drafted.note.id,
      ]),
    });
    expect(memberGroupUpdate.group.noteIds).toEqual(
      ownerGroupUpdate.group.noteIds,
    );

    owner.close();
    member.close();
  });

  it("作者以外は非公開付箋を公開・編集できない", async () => {
    const { owner, member } = await setupRoom();
    send(owner, { type: "note:create" });
    const drafted = await expectType(owner, "note:inserted");

    send(member, {
      type: "note:publish",
      noteId: drafted.note.id,
      x: 100,
      y: 100,
    });
    expect((await expectType(member, "error")).code).toBe("forbidden");

    send(member, {
      type: "note:update-content",
      noteId: drafted.note.id,
      content: "見えてはいけない更新",
    });
    expect((await expectType(member, "error")).code).toBe("forbidden");

    send(owner, {
      type: "note:publish",
      noteId: drafted.note.id,
      x: 100,
      y: 100,
    });
    const ownerMessage = await expectType(owner, "note:inserted");
    const memberMessage = await expectType(member, "note:inserted");
    expect(ownerMessage.note).toMatchObject({
      id: drafted.note.id,
      visibility: "shared",
    });
    expect(memberMessage.note).toMatchObject({
      id: drafted.note.id,
      visibility: "shared",
    });

    owner.close();
    member.close();
  });
});

describe("note:unpublish", () => {
  it("作者がshared付箋をprivateへ戻すと、他メンバーには削除だけが届く", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(owner, { type: "note:unpublish", noteId });
    expect((await expectType(owner, "note:deleted")).noteId).toBe(noteId);
    expect((await expectType(member, "note:deleted")).noteId).toBe(noteId);
    const ownerPrivate = await expectType(owner, "note:inserted");
    expect(ownerPrivate.note).toMatchObject({
      id: noteId,
      visibility: "private",
    });

    send(member, { type: "note:unpublish", noteId });
    expect((await expectType(member, "error")).code).toBe("forbidden");

    owner.close();
    member.close();
  });

  it("共有グループから非公開へ戻した付箋は、他メンバーの再接続snapshotに残らない", async () => {
    const { roomId, owner, member } = await setupRoom();
    const firstNoteId = await createNote({ owner, member });
    const secondNoteId = await createNote({ owner, member });

    send(owner, {
      type: "group:create",
      group: {
        id: "55555555-5555-4555-8555-555555555555",
        name: "共有グループ",
        noteIds: [firstNoteId, secondNoteId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    await expectType(owner, "group:updated");
    await expectType(member, "group:updated");

    send(owner, { type: "note:unpublish", noteId: firstNoteId });
    await expectType(owner, "note:deleted");
    await expectType(owner, "note:inserted");
    await expectType(member, "note:deleted");

    member.close();
    const reconnected = await connectRoomAs(MEMBER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(snapshot.groups).toEqual([]);

    owner.close();
    reconnected.close();
  });
});

describe("private note の永続化", () => {
  it("他メンバーは非公開付箋へ投票できない", async () => {
    const { owner, member } = await setupRoom();
    send(owner, { type: "note:create" });
    const drafted = await expectType(owner, "note:inserted");

    send(member, {
      type: "note:vote",
      noteId: drafted.note.id,
      kind: "objective",
    });

    expect((await expectType(member, "error")).code).toBe("forbidden");

    owner.close();
    member.close();
  });

  it("作者だけが更新・削除でき、再接続後にも更新内容が復元される", async () => {
    const { roomId, owner, member } = await setupRoom();
    send(owner, { type: "note:create" });
    const drafted = await expectType(owner, "note:inserted");

    send(owner, {
      type: "note:update-content",
      noteId: drafted.note.id,
      content: "再接続後も残る下書き",
    });
    const updated = await expectType(owner, "note:updated");
    expect(updated.note).toMatchObject({
      id: drafted.note.id,
      content: "再接続後も残る下書き",
      visibility: "private",
    });

    owner.close();
    const reconnected = await connectRoomAs(OWNER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(snapshot.notes).toMatchObject([
      {
        id: drafted.note.id,
        content: "再接続後も残る下書き",
        visibility: "private",
      },
    ]);

    send(reconnected, { type: "note:delete", noteId: drafted.note.id });
    expect((await expectType(reconnected, "note:deleted")).noteId).toBe(
      drafted.note.id,
    );

    member.close();
    const memberAfterDelete = await connectRoomAs(MEMBER, roomId);
    expect((await expectType(memberAfterDelete, "snapshot")).notes).toEqual([]);

    reconnected.close();
    memberAfterDelete.close();
  });
});

describe("note:update-content / note:move（pgTAP: メンバーの共同編集）", () => {
  it("author でないメンバーも content を更新でき、authorId は変わらない", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(member, {
      type: "note:update-content",
      noteId,
      content: "member が編集",
    });
    const toOwner = await expectType(owner, "note:updated");

    expect(toOwner.note.content).toBe("member が編集");
    // 旧・列レベル GRANT の仕様: 共同編集しても所有権は移らない
    expect(toOwner.note.authorId).toBe(OWNER.sub);

    owner.close();
    member.close();
  });

  it("note:move で位置が確定し、全員に note:updated が届く", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(member, { type: "note:move", noteId, x: 123, y: 456 });
    const toOwner = await expectType(owner, "note:updated");
    const toMember = await expectType(member, "note:updated");

    expect(toOwner.note).toMatchObject({ id: noteId, x: 123, y: 456 });
    expect(toMember.note).toMatchObject({ id: noteId, x: 123, y: 456 });

    owner.close();
    member.close();
  });

  it("存在しない付箋の更新は not-found エラーになる", async () => {
    const { owner, member } = await setupRoom();

    send(owner, {
      type: "note:update-content",
      noteId: "99999999-9999-4999-8999-999999999999",
      content: "ghost",
    });
    const error = await expectType(owner, "error");
    expect(error.code).toBe("not-found");

    owner.close();
    member.close();
  });
});

describe("note:vote（課題ドット投票）", () => {
  it("主観ドットは1票まで投票でき、全員へ集計が届く", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(member, { type: "note:vote", noteId, kind: "subjective" });
    const toOwner = await expectType(owner, "note:updated");
    const toMember = await expectType(member, "note:updated");

    expect(toOwner.note.dotVotes.subjective).toEqual({
      count: 1,
      votedByMe: false,
      ownCount: 0,
    });
    expect(toMember.note.dotVotes.subjective).toEqual({
      count: 1,
      votedByMe: true,
      ownCount: 1,
    });

    owner.close();
    member.close();
  });

  it("投票済みの主観ドットを再度押すと取り消せる", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(member, { type: "note:vote", noteId, kind: "subjective" });
    await expectType(owner, "note:updated");
    await expectType(member, "note:updated");

    send(member, { type: "note:vote", noteId, kind: "subjective" });
    const toOwner = await expectType(owner, "note:updated");
    const toMember = await expectType(member, "note:updated");

    expect(toOwner.note.dotVotes.subjective.count).toBe(0);
    expect(toMember.note.dotVotes.subjective).toMatchObject({
      count: 0,
      votedByMe: false,
      ownCount: 0,
    });

    owner.close();
    member.close();
  });

  it("主観ドットの2票目は forbidden で拒否される", async () => {
    const { roomId, owner, member } = await setupRoom();
    const firstNoteId = await createNote({ owner, member });
    const secondNoteId = await createNote({ owner, member });

    send(member, {
      type: "note:vote",
      noteId: firstNoteId,
      kind: "subjective",
    });
    await expectType(owner, "note:updated");
    await expectType(member, "note:updated");

    send(member, {
      type: "note:vote",
      noteId: secondNoteId,
      kind: "subjective",
    });
    const error = await expectType(member, "error");
    expect(error.code).toBe("forbidden");

    member.close();
    const reconnected = await connectRoomAs(MEMBER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(
      snapshot.notes.filter((note) => note.dotVotes.subjective.votedByMe),
    ).toHaveLength(1);

    reconnected.close();
    owner.close();
  });

  it("客観ドットは3票まで投票でき、4票目は forbidden で拒否される", async () => {
    const { roomId, owner, member } = await setupRoom();
    const noteIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      noteIds.push(await createNote({ owner, member }));
    }

    for (const noteId of noteIds.slice(0, 3)) {
      send(member, { type: "note:vote", noteId, kind: "objective" });
      await expectType(owner, "note:updated");
      await expectType(member, "note:updated");
    }

    send(member, { type: "note:vote", noteId: noteIds[3], kind: "objective" });
    const error = await expectType(member, "error");
    expect(error.code).toBe("forbidden");

    member.close();
    const reconnected = await connectRoomAs(MEMBER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(
      snapshot.notes.filter((note) => note.dotVotes.objective.votedByMe),
    ).toHaveLength(3);

    reconnected.close();
    owner.close();
  });

  it("参加者ごとに客観ドットを3票ずつ投票できる", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    for (const voter of [owner, member]) {
      for (let count = 0; count < 3; count++) {
        send(voter, { type: "note:vote", noteId, kind: "objective" });
        await expectType(owner, "note:updated");
        await expectType(member, "note:updated");
      }
    }

    send(owner, { type: "note:vote", noteId, kind: "objective" });
    expect((await expectType(owner, "error")).code).toBe("forbidden");
    send(member, { type: "note:vote", noteId, kind: "objective" });
    expect((await expectType(member, "error")).code).toBe("forbidden");

    owner.close();
    member.close();
  });

  it("客観ドットは同じ付箋に残り数まで積める", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    for (const expected of [1, 2, 3]) {
      send(member, { type: "note:vote", noteId, kind: "objective" });
      const toOwner = await expectType(owner, "note:updated");
      const toMember = await expectType(member, "note:updated");

      expect(toOwner.note.dotVotes.objective.count).toBe(expected);
      expect(toOwner.note.dotVotes.objective.ownCount).toBe(0);
      expect(toMember.note.dotVotes.objective).toEqual({
        count: expected,
        votedByMe: true,
        ownCount: expected,
      });
    }

    send(member, { type: "note:vote", noteId, kind: "objective" });
    const error = await expectType(member, "error");
    expect(error.code).toBe("forbidden");

    owner.close();
    member.close();
  });

  it("客観ドットはリセットで同じ付箋上の自分の票を0に戻せる", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    for (let i = 0; i < 2; i++) {
      send(member, { type: "note:vote", noteId, kind: "objective" });
      await expectType(owner, "note:updated");
      await expectType(member, "note:updated");
    }

    send(member, { type: "note:vote-reset", noteId, kind: "objective" });
    const toOwner = await expectType(owner, "note:updated");
    const toMember = await expectType(member, "note:updated");

    expect(toOwner.note.dotVotes.objective).toMatchObject({
      count: 0,
      votedByMe: false,
      ownCount: 0,
    });
    expect(toMember.note.dotVotes.objective).toEqual({
      count: 0,
      votedByMe: false,
      ownCount: 0,
    });

    owner.close();
    member.close();
  });
});

describe("note:delete（pgTAP: DELETE は author のみ）", () => {
  it("author は削除でき、全員に note:deleted が届く", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(owner, { type: "note:delete", noteId });
    const toOwner = await expectType(owner, "note:deleted");
    const toMember = await expectType(member, "note:deleted");
    expect(toOwner.noteId).toBe(noteId);
    expect(toMember.noteId).toBe(noteId);

    owner.close();
    member.close();
  });

  it("author でないメンバーの削除は forbidden で拒否され、付箋は残る", async () => {
    const { roomId, owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(member, { type: "note:delete", noteId });
    const error = await expectType(member, "error");
    expect(error.code).toBe("forbidden");

    // 付箋が残っていることを再接続の snapshot で確認する。
    member.close();
    const reconnected = await connectRoomAs(MEMBER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(snapshot.notes.map((n) => n.id)).toContain(noteId);

    reconnected.close();
    owner.close();
  });
});

describe("note:drag（エフェメラル同期）", () => {
  it("他メンバーには届き、送信者自身にはエコーされず、永続化もされない", async () => {
    const { roomId, owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(owner, { type: "note:drag", noteId, x: 300, y: 300 });
    const toMember = await expectType(member, "note:drag");
    expect(toMember).toMatchObject({ noteId, x: 300, y: 300 });

    // 送信者へのエコーが無いことを、後続メッセージの順序で確認する:
    // drag の後に move を送り、owner が次に受け取るのが note:updated であること。
    send(owner, { type: "note:move", noteId, x: 111, y: 222 });
    const next = await owner.next();
    expect(next.type).toBe("note:updated");

    // drag は永続化されない（確定は move だけ）: snapshot は move の値になる。
    owner.close();
    member.close();
    const reconnected = await connectRoomAs(OWNER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(snapshot.notes[0]).toMatchObject({ x: 111, y: 222 });
    reconnected.close();
  });
});

describe("入力検証（コントラクト境界）", () => {
  it("不正な JSON は invalid-message エラーになり、接続は維持される", async () => {
    const { owner, member } = await setupRoom();

    owner.ws.send("not-json{{{");
    const error = await expectType(owner, "error");
    expect(error.code).toBe("invalid-message");

    // 接続が生きていることを確認: 続けて正常な操作ができる。
    send(owner, { type: "note:create" });
    await expectType(owner, "note:inserted");

    owner.close();
    member.close();
  });

  it("本文が2000文字を超える更新は invalid-message で拒否される", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(owner, {
      type: "note:update-content",
      noteId,
      content: "あ".repeat(2001),
    });
    const error = await expectType(owner, "error");
    expect(error.code).toBe("invalid-message");

    owner.close();
    member.close();
  });

  it("ボード範囲外への move は invalid-message で拒否される", async () => {
    const { owner, member } = await setupRoom();
    const noteId = await createNote({ owner, member });

    send(owner, { type: "note:move", noteId, x: -10, y: 99999 });
    const error = await expectType(owner, "error");
    expect(error.code).toBe("invalid-message");

    owner.close();
    member.close();
  });
});

describe("グループ指向のグループ同期", () => {
  it("非公開付箋を含むグループの作成は拒否される", async () => {
    const { owner, member } = await setupRoom();
    const sharedNoteId = await createNote({ owner, member });
    send(owner, { type: "note:create" });
    const drafted = await expectType(owner, "note:inserted");

    send(owner, {
      type: "group:create",
      group: {
        id: "33333333-3333-4333-8333-333333333333",
        name: "非公開グループ",
        noteIds: [drafted.note.id, sharedNoteId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect((await expectType(owner, "error")).code).toBe("forbidden");

    owner.close();
    member.close();
  });

  it("グループを作成・更新でき、再接続時に復元され、付箋の離脱・削除で自動消滅すること", async () => {
    const { roomId, owner, member } = await setupRoom();

    // 付箋を2個作成
    const noteId1 = await createNote({ owner, member });
    const noteId2 = await createNote({ owner, member });

    // G1: [noteId1, noteId2] のグループ作成
    const groupId = "11111111-1111-4111-8111-111111111111";
    const group = {
      id: groupId,
      name: "テストグループ",
      noteIds: [noteId1, noteId2],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    send(owner, {
      type: "group:create",
      group,
    });

    // 配信確認
    const ownerCreate = await expectType(owner, "group:updated");
    expect(ownerCreate.group.id).toBe(groupId);
    expect(ownerCreate.group.name).toBe("テストグループ");

    const memberCreate = await expectType(member, "group:updated");
    expect(memberCreate.group.id).toBe(groupId);

    // グループ名を更新
    send(owner, {
      type: "group:update-name",
      groupId,
      name: "更新されたグループ",
    });

    const ownerUpdate = await expectType(owner, "group:updated");
    expect(ownerUpdate.group.name).toBe("更新されたグループ");

    const memberUpdate = await expectType(member, "group:updated");
    expect(memberUpdate.group.name).toBe("更新されたグループ");

    // 切断して再接続
    owner.close();
    member.close();
    const reconnected = await connectRoomAs(OWNER, roomId);
    const snapshot = await expectType(reconnected, "snapshot");
    expect(snapshot.groups).toBeDefined();
    expect(snapshot.groups?.find((g) => g.id === groupId)?.name).toBe(
      "更新されたグループ",
    );

    // 付箋1を削除 -> 残り付箋が1個になるので自動消滅するはず
    const member2 = await connectRoomAs(MEMBER, roomId);
    await expectType(member2, "snapshot");

    send(reconnected, { type: "note:delete", noteId: noteId1 });
    await expectType(reconnected, "note:deleted");
    await expectType(member2, "note:deleted");

    // グループ消滅イベントが飛んでくるはず
    const ownerDel = await expectType(reconnected, "group:deleted");
    expect(ownerDel.groupId).toBe(groupId);

    const memberDel = await expectType(member2, "group:deleted");
    expect(memberDel.groupId).toBe(groupId);

    reconnected.close();
    member2.close();
  });

  it("存在しない代表付箋IDへのグループ名更新は not-found で拒否されること", async () => {
    const { owner, member } = await setupRoom();
    const fakeId = "99999999-9999-4999-8999-999999999999";

    send(owner, {
      type: "group:update-name",
      groupId: fakeId,
      name: "エラーグループ",
    });

    const error = await expectType(owner, "error");
    expect(error.code).toBe("not-found");

    owner.close();
    member.close();
  });
});

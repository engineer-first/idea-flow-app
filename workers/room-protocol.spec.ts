// RoomDO の WebSocket プロトコルのテスト。
// Supabase 時代の pgTAP テストのうち付箋の認可仕様をプロトコル境界に移植した:
// - メンバーは他人の付箋の content / 位置を更新できる（共同編集）
// - author 以外は削除できない（forbidden エラー、付箋は残る）
// - authorId / roomId の書き換えは「そもそもメッセージが存在しない」ため構造的に不可能
//   （旧: 列レベル GRANT。update-content が authorId を変えないことをここで固定する）
// 加えて PoC の同期セマンティクスを検証する:
// - note:drag は永続化されず、送信者自身にはエコーされない
// - 再接続時は snapshot で現在状態へ復帰できる（R1 復帰パス）
import { describe, expect, it } from "vitest";
import {
  NOTE_SPAWN_JITTER,
  NOTE_SPAWN_X_MIN,
  NOTE_SPAWN_Y_MIN,
} from "../contracts/board";
import type { ServerMessage } from "../contracts/room-protocol";
import {
  connectRoomAs,
  createRoomAs,
  joinRoomAs,
  type RoomSocket,
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
  const inserted = await expectType(room.owner, "note:inserted");
  await expectType(room.member, "note:inserted");
  return inserted.note.id;
}

describe("snapshot（接続・再接続の復帰パス）", () => {
  it("接続直後に room 情報・自分の userId・付箋一覧が届く", async () => {
    const { roomId, inviteCode } = await createRoomAs(OWNER);
    const socket = await connectRoomAs(OWNER, roomId);
    const snapshot = await expectType(socket, "snapshot");

    expect(snapshot.room).toEqual({ roomId, inviteCode });
    expect(snapshot.self).toEqual({ userId: OWNER.sub });
    expect(snapshot.notes).toEqual([]);
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

    reconnected.close();
    member.close();
  });
});

describe("note:create", () => {
  it("作成者を authorId として全メンバーに note:inserted が届く", async () => {
    const { roomId, owner, member } = await setupRoom();

    send(owner, { type: "note:create" });
    const toOwner = await expectType(owner, "note:inserted");
    const toMember = await expectType(member, "note:inserted");

    expect(toOwner.note).toEqual(toMember.note);
    expect(toOwner.note.authorId).toBe(OWNER.sub);
    expect(toOwner.note.roomId).toBe(roomId);
    expect(toOwner.note.content).toBe("");
    // 新規付箋はボード中央付近に配置される（PoC と同じ挙動）
    expect(toOwner.note.x).toBeGreaterThanOrEqual(NOTE_SPAWN_X_MIN);
    expect(toOwner.note.x).toBeLessThanOrEqual(
      NOTE_SPAWN_X_MIN + NOTE_SPAWN_JITTER,
    );
    expect(toOwner.note.y).toBeGreaterThanOrEqual(NOTE_SPAWN_Y_MIN);
    expect(toOwner.note.y).toBeLessThanOrEqual(
      NOTE_SPAWN_Y_MIN + NOTE_SPAWN_JITTER,
    );

    owner.close();
    member.close();
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

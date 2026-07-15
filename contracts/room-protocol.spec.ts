// ルーム内 WebSocket プロトコルの境界スキーマの単体テスト。
// - 各種 ServerMessage / ClientMessage の正常系
// - 想定外のフィールドや型違いを negative テストで弾く
// - parseClientMessage / parseServerMessage のラッパが「不正入力で null」
//   を返すことを保証する（接続維持の挙動は workers/room-protocol.spec.ts）
import { describe, expect, it } from "vitest";
import { buildLobbyPhase, buildPhaseStep } from "./phase.fixture";
import {
  ClientMessageSchema,
  MemberSchema,
  NOTE_COLOR_PALETTE,
  NoteColorSchema,
  NoteSchema,
  parseClientMessage,
  parseServerMessage,
  ServerMessageSchema,
  TimerStateSchema,
} from "./room-protocol";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const LOBBY = buildLobbyPhase();
const STEP_1_1 = buildPhaseStep(1);
const STEP_1_2 = buildPhaseStep(2);
const STEP_1_5 = buildPhaseStep(5);

describe("NoteColorSchema", () => {
  it("固定20色のパレットを受け入れ、重複を持たない", () => {
    expect(NOTE_COLOR_PALETTE).toHaveLength(20);
    expect(new Set(NOTE_COLOR_PALETTE).size).toBe(20);
    for (const color of NOTE_COLOR_PALETTE) {
      expect(NoteColorSchema.parse(color)).toBe(color);
    }
  });

  it("パレット外の色は拒否する", () => {
    expect(NoteColorSchema.safeParse("black").success).toBe(false);
  });
});

describe("TimerStateSchema", () => {
  it("負数や有限でない時刻・時間を拒否する", () => {
    expect(
      TimerStateSchema.safeParse({
        status: "running",
        endsAt: Number.POSITIVE_INFINITY,
        durationMs: 60_000,
      }).success,
    ).toBe(false);
    expect(
      TimerStateSchema.safeParse({
        status: "paused",
        remainingMs: -1,
        durationMs: 60_000,
      }).success,
    ).toBe(false);
    expect(
      TimerStateSchema.safeParse({
        status: "paused",
        remainingMs: 60_000,
        durationMs: 5_999_001,
      }).success,
    ).toBe(false);
  });

  it("idle / running / paused の共有状態を受け入れる", () => {
    expect(TimerStateSchema.parse({ status: "idle" })).toEqual({
      status: "idle",
    });
    expect(
      TimerStateSchema.parse({
        status: "running",
        endsAt: 1_700_000_060_000,
        durationMs: 60_000,
      }),
    ).toEqual({
      status: "running",
      endsAt: 1_700_000_060_000,
      durationMs: 60_000,
    });
    expect(
      TimerStateSchema.parse({
        status: "paused",
        remainingMs: 30_000,
        durationMs: 60_000,
      }),
    ).toEqual({
      status: "paused",
      remainingMs: 30_000,
      durationMs: 60_000,
    });
  });
});

describe("MemberSchema", () => {
  it("userId と name を受け入れる", () => {
    expect(
      MemberSchema.parse({
        userId: USER_A,
        name: "Yuki Tanaka",
        color: "yellow",
      }),
    ).toEqual({
      userId: USER_A,
      name: "Yuki Tanaka",
      color: "yellow",
    });
  });

  it("UUID でない userId は拒否する", () => {
    expect(
      MemberSchema.safeParse({ userId: "not-a-uuid", name: "x" }).success,
    ).toBe(false);
  });

  it("name が無いと拒否する", () => {
    expect(MemberSchema.safeParse({ userId: USER_A }).success).toBe(false);
  });
});

describe("NoteSchema", () => {
  const note = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    authorId: USER_A,
    content: "個人メモ",
    color: "yellow",
    x: 100,
    y: 200,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    dotVotes: {
      subjective: { count: 0, votedByMe: false, ownCount: 0 },
      objective: { count: 0, votedByMe: false, ownCount: 0 },
    },
  };

  it.each(["private", "shared"])("visibility=%s を受け入れる", (visibility) => {
    expect(NoteSchema.parse({ ...note, visibility }).visibility).toBe(
      visibility,
    );
  });

  it("visibility が無い付箋は拒否する", () => {
    expect(NoteSchema.safeParse(note).success).toBe(false);
  });
});

describe("ServerMessageSchema", () => {
  it("snapshot は notes / members / phase / isHost を必須にする", () => {
    const parsed = ServerMessageSchema.parse({
      type: "snapshot",
      notes: [],
      members: [{ userId: USER_A, name: "Owner", color: "yellow" }],
      phase: LOBBY,
      isHost: true,
      timer: { status: "idle" },
      serverNow: 1_700_000_000_000,
    });
    expect(parsed).toEqual({
      type: "snapshot",
      notes: [],
      members: [{ userId: USER_A, name: "Owner", color: "yellow" }],
      phase: LOBBY,
      isHost: true,
      timer: { status: "idle" },
      serverNow: 1_700_000_000_000,
    });
  });

  it("snapshot に members フィールドが無いと拒否する", () => {
    const result = ServerMessageSchema.safeParse({
      type: "snapshot",
      notes: [],
      phase: LOBBY,
    });
    expect(result.success).toBe(false);
  });

  it("snapshot に phase フィールドが無いと拒否する", () => {
    const result = ServerMessageSchema.safeParse({
      type: "snapshot",
      notes: [],
      members: [{ userId: USER_A, name: "Owner", color: "yellow" }],
      isHost: true,
    });
    expect(result.success).toBe(false);
  });

  it("snapshot に isHost フィールドが無いと拒否する", () => {
    const result = ServerMessageSchema.safeParse({
      type: "snapshot",
      notes: [],
      members: [{ userId: USER_A, name: "Owner", color: "yellow" }],
      phase: LOBBY,
    });
    expect(result.success).toBe(false);
  });

  it("member_joined を受け入れる", () => {
    const parsed = ServerMessageSchema.parse({
      type: "member_joined",
      member: { userId: USER_A, name: "Owner", color: "yellow" },
    });
    expect(parsed).toEqual({
      type: "member_joined",
      member: { userId: USER_A, name: "Owner", color: "yellow" },
    });
  });

  it("phase:updated は lobby と課題整理ステップを受け入れる", () => {
    expect(
      ServerMessageSchema.parse({ type: "phase:updated", phase: LOBBY }),
    ).toEqual({ type: "phase:updated", phase: LOBBY });
    expect(
      ServerMessageSchema.parse({ type: "phase:updated", phase: STEP_1_1 }),
    ).toEqual({ type: "phase:updated", phase: STEP_1_1 });
    expect(
      ServerMessageSchema.parse({ type: "phase:updated", phase: STEP_1_2 }),
    ).toEqual({ type: "phase:updated", phase: STEP_1_2 });
    expect(
      ServerMessageSchema.parse({ type: "phase:updated", phase: STEP_1_5 }),
    ).toEqual({ type: "phase:updated", phase: STEP_1_5 });
  });

  it("phase:next クライアントメッセージを受け入れる", () => {
    expect(ClientMessageSchema.parse({ type: "phase:next" })).toEqual({
      type: "phase:next",
    });
  });

  it("phase:next は force フラグを受け入れ、パース結果に保持する", () => {
    expect(
      ClientMessageSchema.parse({ type: "phase:next", force: true }),
    ).toEqual({ type: "phase:next", force: true });
  });

  it("phase:next の force に boolean 以外は拒否する", () => {
    expect(
      ClientMessageSchema.safeParse({ type: "phase:next", force: "yes" })
        .success,
    ).toBe(false);
  });

  it("error は voting-incomplete コードを受け入れる", () => {
    expect(
      ServerMessageSchema.parse({
        type: "error",
        code: "voting-incomplete",
        message: "全員の主観・客観投票が完了していません。",
      }),
    ).toEqual({
      type: "error",
      code: "voting-incomplete",
      message: "全員の主観・客観投票が完了していません。",
    });
  });

  it("error の未知の code は拒否する", () => {
    expect(
      ServerMessageSchema.safeParse({
        type: "error",
        code: "rate-limited",
        message: "x",
      }).success,
    ).toBe(false);
  });

  it("phase:updated に未知のフェーズは拒否する", () => {
    expect(
      ServerMessageSchema.safeParse({ type: "phase:updated", phase: "done" })
        .success,
    ).toBe(false);
  });

  it("旧 phase_changed は受け付けない", () => {
    expect(
      ServerMessageSchema.safeParse({
        type: "phase_changed",
        phase: STEP_1_1,
      }).success,
    ).toBe(false);
  });

  it("member_left を受け入れる", () => {
    const parsed = ServerMessageSchema.parse({
      type: "member_left",
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed).toEqual({
      type: "member_left",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("member_left は userId が必要", () => {
    expect(ServerMessageSchema.safeParse({ type: "member_left" }).success).toBe(
      false,
    );
  });

  it("member_left の userId は UUID 形式", () => {
    expect(
      ServerMessageSchema.safeParse({ type: "member_left", userId: "not-uuid" })
        .success,
    ).toBe(false);
  });

  it("未知の type は拒否する", () => {
    expect(
      ServerMessageSchema.safeParse({ type: "unknown", payload: {} }).success,
    ).toBe(false);
  });
});

describe("ClientMessageSchema", () => {
  it("timer:start は 1ms〜99分59秒だけを受け入れる", () => {
    expect(
      ClientMessageSchema.parse({ type: "timer:start", durationMs: 1 }),
    ).toEqual({ type: "timer:start", durationMs: 1 });
    expect(
      ClientMessageSchema.parse({
        type: "timer:start",
        durationMs: 5_999_000,
      }),
    ).toEqual({ type: "timer:start", durationMs: 5_999_000 });
    for (const durationMs of [0, -1, 5_999_001, 1.5]) {
      expect(
        ClientMessageSchema.safeParse({ type: "timer:start", durationMs })
          .success,
      ).toBe(false);
    }
  });

  it.each([
    "timer:pause",
    "timer:resume",
    "timer:extend",
    "timer:stop",
  ])("%s はペイロードなしで受け入れる", (type) => {
    expect(ClientMessageSchema.parse({ type })).toEqual({ type });
  });

  it("note:publish は付箋IDとボード座標を受け入れる", () => {
    expect(
      ClientMessageSchema.parse({
        type: "note:publish",
        noteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        x: 400,
        y: 300,
      }),
    ).toMatchObject({ type: "note:publish", x: 400, y: 300 });
  });

  it("note:publish はボード外の座標を拒否する", () => {
    expect(
      ClientMessageSchema.safeParse({
        type: "note:publish",
        noteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        x: -1,
        y: 0,
      }).success,
    ).toBe(false);
  });

  it("note:unpublish は付箋IDを受け入れる", () => {
    expect(
      ClientMessageSchema.parse({
        type: "note:unpublish",
        noteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    ).toEqual({
      type: "note:unpublish",
      noteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("note:unpublish はUUIDでない付箋IDを拒否する", () => {
    expect(
      ClientMessageSchema.safeParse({
        type: "note:unpublish",
        noteId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("start_phase を受け入れる", () => {
    expect(ClientMessageSchema.parse({ type: "start_phase" })).toEqual({
      type: "start_phase",
    });
  });

  it("start_phase に余計なフィールドがあっても無視する（passthrough しない）", () => {
    expect(
      ClientMessageSchema.safeParse({ type: "start_phase", phase: "phase1" })
        .success,
    ).toBe(true);
  });

  it("leave_room はクライアント送信メッセージに存在しない（REST で退出する）", () => {
    // 退出は api-worker の POST /api/rooms/:id/leave 経由で行う。WS には
    // 退出メッセージを送らない（クライアントが明示的に REST で抜ける）。
    expect(ClientMessageSchema.safeParse({ type: "leave_room" }).success).toBe(
      false,
    );
  });

  it("未知の type は拒否する", () => {
    expect(
      ClientMessageSchema.safeParse({ type: "phase:force", phase: "phase1" })
        .success,
    ).toBe(false);
  });
});

describe("parseServerMessage", () => {
  it("正常な JSON 文字列をパースしてオブジェクトを返す", () => {
    expect(
      parseServerMessage(
        JSON.stringify({
          type: "snapshot",
          notes: [],
          members: [],
          phase: LOBBY,
          isHost: false,
          timer: { status: "idle" },
          serverNow: 1_700_000_000_000,
        }),
      ),
    ).toEqual({
      type: "snapshot",
      notes: [],
      members: [],
      phase: LOBBY,
      isHost: false,
      timer: { status: "idle" },
      serverNow: 1_700_000_000_000,
    });
  });

  it("JSON 以外の文字列は null", () => {
    expect(parseServerMessage("not-json")).toBeNull();
  });

  it("string 以外は null", () => {
    expect(parseServerMessage(123)).toBeNull();
    expect(parseServerMessage(null)).toBeNull();
    expect(parseServerMessage({ type: "snapshot" })).toBeNull();
  });

  it("スキーマ違反の JSON は null（接続を落とさずエラーを返すパターンの入力層）", () => {
    expect(
      parseServerMessage(JSON.stringify({ type: "snapshot", notes: [] })),
    ).toBeNull();
  });
});

describe("parseClientMessage", () => {
  it("start_phase をパースする", () => {
    expect(parseClientMessage(JSON.stringify({ type: "start_phase" }))).toEqual(
      { type: "start_phase" },
    );
  });

  it("member_joined はクライアント送信メッセージに存在しないので拒否する", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "member_joined",
          member: { userId: USER_A, name: "X" },
        }),
      ),
    ).toBeNull();
  });

  it("phase:updated はクライアント送信メッセージには存在しない", () => {
    expect(
      parseClientMessage(
        JSON.stringify({ type: "phase:updated", phase: "phase1" }),
      ),
    ).toBeNull();
  });

  it("不正な JSON は null", () => {
    expect(parseClientMessage("{")).toBeNull();
  });
});

// スキーマの網羅性チェック: 新しい type を追加したら上のテストにも必ず対応する
// ケースを追加する（型推論の保護とプロトコル拡張の追跡のため）。
describe("プロトコル整合性", () => {
  it("ServerMessageSchema と parseServerMessage は同じ型を返す", () => {
    const json = JSON.stringify({
      type: "member_joined",
      member: { userId: USER_A, name: "A", color: "yellow" },
    });
    const parsed = parseServerMessage(json);
    const direct = ServerMessageSchema.parse(JSON.parse(json));
    expect(parsed).toEqual(direct);
  });
});

void USER_B;

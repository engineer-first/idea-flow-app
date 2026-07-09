// ルーム内 WebSocket プロトコルの境界スキーマの単体テスト。
// - 各種 ServerMessage / ClientMessage の正常系
// - 想定外のフィールドや型違いを negative テストで弾く
// - parseClientMessage / parseServerMessage のラッパが「不正入力で null」
//   を返すことを保証する（接続維持の挙動は workers/room-protocol.spec.ts）
import { describe, expect, it } from "vitest";
import {
  ClientMessageSchema,
  MemberSchema,
  PhaseSchema,
  parseClientMessage,
  parseServerMessage,
  ServerMessageSchema,
} from "./room-protocol";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("PhaseSchema", () => {
  it("lobby と writing だけを受け入れる", () => {
    expect(PhaseSchema.parse("lobby")).toBe("lobby");
    expect(PhaseSchema.parse("writing")).toBe("writing");
  });

  it("未知のフェーズは拒否する", () => {
    expect(PhaseSchema.safeParse("review").success).toBe(false);
    expect(PhaseSchema.safeParse("").success).toBe(false);
  });
});

describe("MemberSchema", () => {
  it("userId と name を受け入れる", () => {
    expect(MemberSchema.parse({ userId: USER_A, name: "Yuki Tanaka" })).toEqual(
      {
        userId: USER_A,
        name: "Yuki Tanaka",
      },
    );
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

describe("ServerMessageSchema", () => {
  it("snapshot は notes / members / phase を必須にする", () => {
    const parsed = ServerMessageSchema.parse({
      type: "snapshot",
      notes: [],
      members: [{ userId: USER_A, name: "Owner" }],
      phase: "lobby",
    });
    expect(parsed).toEqual({
      type: "snapshot",
      notes: [],
      members: [{ userId: USER_A, name: "Owner" }],
      phase: "lobby",
    });
  });

  it("snapshot に members フィールドが無いと拒否する", () => {
    const result = ServerMessageSchema.safeParse({
      type: "snapshot",
      notes: [],
      phase: "lobby",
    });
    expect(result.success).toBe(false);
  });

  it("snapshot に phase フィールドが無いと拒否する", () => {
    const result = ServerMessageSchema.safeParse({
      type: "snapshot",
      notes: [],
      members: [{ userId: USER_A, name: "Owner" }],
    });
    expect(result.success).toBe(false);
  });

  it("member_joined を受け入れる", () => {
    const parsed = ServerMessageSchema.parse({
      type: "member_joined",
      member: { userId: USER_A, name: "Owner" },
    });
    expect(parsed).toEqual({
      type: "member_joined",
      member: { userId: USER_A, name: "Owner" },
    });
  });

  it("phase_changed は lobby / writing のみ受け入れる", () => {
    expect(
      ServerMessageSchema.parse({ type: "phase_changed", phase: "lobby" }),
    ).toEqual({ type: "phase_changed", phase: "lobby" });
    expect(
      ServerMessageSchema.parse({ type: "phase_changed", phase: "writing" }),
    ).toEqual({ type: "phase_changed", phase: "writing" });
  });

  it("phase_changed に未知のフェーズは拒否する", () => {
    expect(
      ServerMessageSchema.safeParse({ type: "phase_changed", phase: "done" })
        .success,
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
  it("start_phase を受け入れる", () => {
    expect(ClientMessageSchema.parse({ type: "start_phase" })).toEqual({
      type: "start_phase",
    });
  });

  it("start_phase に余計なフィールドがあっても無視する（passthrough しない）", () => {
    expect(
      ClientMessageSchema.safeParse({ type: "start_phase", phase: "writing" })
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
      ClientMessageSchema.safeParse({ type: "phase:force", phase: "writing" })
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
          phase: "lobby",
        }),
      ),
    ).toEqual({
      type: "snapshot",
      notes: [],
      members: [],
      phase: "lobby",
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

  it("phase_changed もクライアント送信メッセージには存在しない", () => {
    expect(
      parseClientMessage(
        JSON.stringify({ type: "phase_changed", phase: "writing" }),
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
      member: { userId: USER_A, name: "A" },
    });
    const parsed = parseServerMessage(json);
    const direct = ServerMessageSchema.parse(JSON.parse(json));
    expect(parsed).toEqual(direct);
  });
});

void USER_B;

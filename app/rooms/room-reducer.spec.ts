import { describe, expect, it } from "vitest";
import {
  applyMemberServerMessage,
  applyPhaseServerMessage,
} from "@/app/rooms/room-reducer";
import type {
  Phase,
  ProtocolMember,
  ServerMessage,
} from "@/contracts/room-protocol";

const A: ProtocolMember = {
  userId: "11111111-1111-4111-8111-111111111111",
  name: "Yuki Tanaka",
};
const B: ProtocolMember = {
  userId: "22222222-2222-4222-8222-222222222222",
  name: "Taro Yamada",
};

describe("applyMemberServerMessage", () => {
  it("snapshot.members で members state を丸ごと置き換える", () => {
    const message: ServerMessage = {
      type: "snapshot",
      notes: [],
      members: [A, B],
    };
    expect(applyMemberServerMessage([], message)).toEqual([A, B]);
  });

  it("member_joined で新しいメンバーを追加する", () => {
    const message: ServerMessage = {
      type: "member_joined",
      member: B,
    };
    expect(applyMemberServerMessage([A], message)).toEqual([A, B]);
  });

  it("member_joined で同一 userId は name を最新化して反映（重複しない）", () => {
    const renamed: ProtocolMember = { userId: A.userId, name: "新しい名前" };
    const message: ServerMessage = {
      type: "member_joined",
      member: renamed,
    };
    const result = applyMemberServerMessage([A, B], message);
    expect(result).toEqual([renamed, B]);
    // 同じ userId の重複がない
    expect(result.filter((m) => m.userId === A.userId)).toHaveLength(1);
  });

  it("ノート系メッセージは members を変えない", () => {
    const message: ServerMessage = {
      type: "note:inserted",
      note: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        authorId: A.userId,
        content: "",
        x: 0,
        y: 0,
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T00:00:00.000Z",
      },
    };
    expect(applyMemberServerMessage([A], message)).toEqual([A]);
  });

  it("phase_changed は members を変えない", () => {
    const message: ServerMessage = { type: "phase_changed", phase: "writing" };
    expect(applyMemberServerMessage([A], message)).toEqual([A]);
  });
});

describe("applyPhaseServerMessage", () => {
  it("初期値は lobby", () => {
    expect(
      applyPhaseServerMessage("lobby", {
        type: "error",
        code: "forbidden",
        message: "x",
      }),
    ).toBe("lobby");
  });

  it("phase_changed で writing に進める", () => {
    const message: ServerMessage = { type: "phase_changed", phase: "writing" };
    expect(applyPhaseServerMessage("lobby", message)).toBe("writing");
  });

  it("ノート系メッセージは phase を変えない", () => {
    const message: ServerMessage = {
      type: "note:inserted",
      note: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        authorId: A.userId,
        content: "",
        x: 0,
        y: 0,
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T00:00:00.000Z",
      },
    };
    expect(applyPhaseServerMessage("lobby", message)).toBe("lobby");
  });

  it("member_joined は phase を変えない", () => {
    const message: ServerMessage = { type: "member_joined", member: B };
    expect(applyPhaseServerMessage("writing", message)).toBe("writing");
  });

  it("snapshot メッセージは phase を変えない（snapshot には phase を含めない）", () => {
    const message: ServerMessage = {
      type: "snapshot",
      notes: [],
      members: [A],
    };
    expect(applyPhaseServerMessage("lobby" as Phase, message)).toBe("lobby");
  });
});

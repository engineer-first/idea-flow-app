// useRoomState（メンバー・進行状態・タイマーのサーバーメッセージ適用）の単体テスト。
// 純関数 reducer 自体の仕様は room-reducer.spec が担うため、ここでは
// 「state への配線」と「入退出 toast の出し分け」だけを検証する。
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyMocks = vi.hoisted(() => ({
  memberJoined: vi.fn(),
  memberLeft: vi.fn(),
}));
vi.mock("./room-notify", () => ({
  roomNotify: {
    memberJoined: notifyMocks.memberJoined,
    memberLeft: notifyMocks.memberLeft,
    roomLeft: vi.fn(),
    roomDisbanded: vi.fn(),
    roomDisbandedBySelf: vi.fn(),
  },
}));

import { buildMembers } from "@/contracts/room-protocol.fixture";
import { useRoomState } from "./use-room-state";

describe("useRoomState", () => {
  beforeEach(() => {
    notifyMocks.memberJoined.mockReset();
    notifyMocks.memberLeft.mockReset();
  });

  function setup() {
    return renderHook(() =>
      useRoomState({ initialMembers: [], initialPhase: "lobby" }),
    );
  }

  it("snapshot で members / phase / timer を復元する", () => {
    const { result } = setup();
    act(() =>
      result.current.applyMessage({
        type: "snapshot",
        notes: [],
        members: buildMembers(2),
        phase: "phase2",
        isHost: true,
        timer: { status: "running", endsAt: 1_000, durationMs: 60_000 },
        serverNow: 500,
      }),
    );

    expect(result.current.members).toHaveLength(2);
    expect(result.current.phase).toBe("phase2");
    expect(result.current.timer.status).toBe("running");
  });

  it("member_joined で追加し、memberJoined を toast する", () => {
    const { result } = setup();
    act(() =>
      result.current.applyMessage({
        type: "member_joined",
        member: { userId: "u1", name: "Taro", color: "yellow" },
      }),
    );

    expect(result.current.members).toHaveLength(1);
    expect(notifyMocks.memberJoined).toHaveBeenCalledWith("Taro");
  });

  it("member_left は除去前の一覧から名前を引いて memberLeft を toast する", () => {
    const { result } = setup();
    act(() =>
      result.current.applyMessage({
        type: "member_joined",
        member: { userId: "u1", name: "Taro", color: "yellow" },
      }),
    );
    act(() =>
      result.current.applyMessage({ type: "member_left", userId: "u1" }),
    );

    expect(result.current.members).toHaveLength(0);
    expect(notifyMocks.memberLeft).toHaveBeenCalledWith("Taro");
  });

  it("連続メッセージでも ref 同期により最新の members から名前を引ける", () => {
    const { result } = setup();
    // 同一 act 内（= 再レンダー前）に joined → left が連続で届くケース。
    act(() => {
      result.current.applyMessage({
        type: "member_joined",
        member: { userId: "u1", name: "Taro", color: "yellow" },
      });
      result.current.applyMessage({ type: "member_left", userId: "u1" });
    });

    expect(notifyMocks.memberLeft).toHaveBeenCalledWith("Taro");
    expect(result.current.members).toHaveLength(0);
  });
});

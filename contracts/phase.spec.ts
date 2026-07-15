import { describe, expect, it } from "vitest";
import {
  getRoomPhaseLabel,
  isGroupingStep,
  isLobby,
  isPhaseStep,
  isResultStep,
  isVotingStep,
  PHASE_STEP_COUNTS,
  RoomPhaseSchema,
} from "./phase";
import { buildLobbyPhase, buildPhaseStep } from "./phase.fixture";

describe("RoomPhaseSchema", () => {
  it("lobby とフェーズ1の有効なステップを受け入れる", () => {
    expect(PHASE_STEP_COUNTS).toEqual({ 1: 5 });
    expect(RoomPhaseSchema.parse(buildLobbyPhase())).toEqual(buildLobbyPhase());
    expect(RoomPhaseSchema.parse(buildPhaseStep(1))).toEqual(buildPhaseStep(1));
    expect(RoomPhaseSchema.parse(buildPhaseStep(5))).toEqual(buildPhaseStep(5));
  });

  it.each([
    { kind: "step", phase: 1, step: 0 },
    { kind: "step", phase: 1, step: 6 },
    { kind: "step", phase: 2, step: 1 },
    { kind: "step", phase: 1, step: 1.5 },
    { kind: "unknown" },
    "phase1",
  ])("未実装フェーズ・範囲外ステップ・未知の状態を拒否する: %o", (value) => {
    expect(RoomPhaseSchema.safeParse(value).success).toBe(false);
  });
});

describe("RoomPhase の判定ヘルパー", () => {
  it.each([
    {
      phase: buildLobbyPhase(),
      expectedStep: 1,
      lobby: true,
      grouping: false,
      voting: false,
      result: false,
    },
    {
      phase: buildPhaseStep(1),
      expectedStep: 1,
      lobby: false,
      grouping: false,
      voting: false,
      result: false,
    },
    {
      phase: buildPhaseStep(2),
      expectedStep: 2,
      lobby: false,
      grouping: false,
      voting: false,
      result: false,
    },
    {
      phase: buildPhaseStep(3),
      expectedStep: 3,
      lobby: false,
      grouping: true,
      voting: false,
      result: false,
    },
    {
      phase: buildPhaseStep(4),
      expectedStep: 4,
      lobby: false,
      grouping: true,
      voting: true,
      result: false,
    },
    {
      phase: buildPhaseStep(5),
      expectedStep: 5,
      lobby: false,
      grouping: true,
      voting: false,
      result: true,
    },
  ])("$phase の判定結果を返す", ({
    phase,
    expectedStep,
    lobby,
    grouping,
    voting,
    result,
  }) => {
    expect(isLobby(phase)).toBe(lobby);
    expect(isPhaseStep(phase, 1, expectedStep)).toBe(!lobby);
    expect(isGroupingStep(phase)).toBe(grouping);
    expect(isVotingStep(phase)).toBe(voting);
    expect(isResultStep(phase)).toBe(result);
  });

  it("異なるステップは isPhaseStep で false になる", () => {
    expect(isPhaseStep(buildPhaseStep(2), 1, 1)).toBe(false);
  });
});

describe("RoomPhase の表示ラベル", () => {
  it.each([
    [buildLobbyPhase(), "開始待ち"],
    [buildPhaseStep(1), "1-1 個人で書く"],
    [buildPhaseStep(2), "1-2 共有する"],
    [buildPhaseStep(3), "1-3 グループ化"],
    [buildPhaseStep(4), "1-4 ステルス投票"],
    [buildPhaseStep(5), "1-5 結果集計・絞り込み"],
    [{ kind: "step", phase: 2, step: 1 } as const, "フェーズ2・ステップ1"],
  ] as const)("%o を %s と表示する", (phase, label) => {
    expect(getRoomPhaseLabel(phase)).toBe(label);
  });
});

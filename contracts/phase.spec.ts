import { describe, expect, it } from "vitest";
import { PHASE_STEP_COUNTS, RoomPhaseSchema } from "./phase";

describe("RoomPhaseSchema", () => {
  it("lobby とフェーズ1の有効なステップを受け入れる", () => {
    expect(PHASE_STEP_COUNTS).toEqual({ 1: 5 });
    expect(RoomPhaseSchema.parse({ kind: "lobby" })).toEqual({
      kind: "lobby",
    });
    expect(RoomPhaseSchema.parse({ kind: "step", phase: 1, step: 1 })).toEqual({
      kind: "step",
      phase: 1,
      step: 1,
    });
    expect(RoomPhaseSchema.parse({ kind: "step", phase: 1, step: 5 })).toEqual({
      kind: "step",
      phase: 1,
      step: 5,
    });
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

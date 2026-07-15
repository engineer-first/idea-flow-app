// ルームの進行状態コントラクト。lobby と、フェーズごとのステップを
// 判別可能な直和で表す。後続フェーズを追加するときは PHASE_STEP_COUNTS と
// RoomPhaseSchema の両方を拡張する。
import { z } from "zod";

export const PHASE_STEP_COUNTS = { 1: 5 } as const;

export const RoomPhaseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lobby") }),
  z.object({
    kind: z.literal("step"),
    phase: z.literal(1),
    step: z.number().int().min(1).max(PHASE_STEP_COUNTS[1]),
  }),
]);

export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

export function isLobby(
  phase: RoomPhase,
): phase is Extract<RoomPhase, { kind: "lobby" }> {
  return phase.kind === "lobby";
}

export function isPhaseStep(
  phase: RoomPhase,
  expectedPhase: number,
  expectedStep: number,
): boolean {
  return (
    phase.kind === "step" &&
    phase.phase === expectedPhase &&
    phase.step === expectedStep
  );
}

export function isVotingStep(phase: RoomPhase): boolean {
  return isPhaseStep(phase, 1, 4);
}

export function isGroupingStep(phase: RoomPhase): boolean {
  return phase.kind === "step" && phase.phase === 1 && phase.step >= 3;
}

export function isResultStep(phase: RoomPhase): boolean {
  return isPhaseStep(phase, 1, 5);
}

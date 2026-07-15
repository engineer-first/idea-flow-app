import type { RoomPhase, RoomStepPhase } from "./phase";

export function buildLobbyPhase(): Extract<RoomPhase, { kind: "lobby" }> {
  return { kind: "lobby" };
}

export function buildPhaseStep(
  step: number,
  phase: RoomStepPhase["phase"] = 1,
): RoomStepPhase {
  return { kind: "step", phase, step } as RoomStepPhase;
}

import type { RoomPhase } from "./phase";

export function buildLobbyPhase(): Extract<RoomPhase, { kind: "lobby" }> {
  return { kind: "lobby" };
}

export function buildPhaseStep(
  step: number,
): Extract<RoomPhase, { kind: "step" }> {
  return { kind: "step", phase: 1, step };
}

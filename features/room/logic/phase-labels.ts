import type { RoomPhase } from "@/contracts/phase";

// ステップの表示ラベル。ヘッダーの現在ステップ表示と、ステップ移行の
// 確認ダイアログの説明文が共有するため logic に置く（文言は定数）。
export function getPhaseLabel(phase: RoomPhase): string {
  if (phase.kind === "lobby") return "開始待ち";
  if (phase.phase !== 1) return `フェーズ${phase.phase}・ステップ${phase.step}`;
  switch (phase.step) {
    case 1:
      return "1-1 個人で書く";
    case 2:
      return "1-2 共有する";
    case 3:
      return "1-3 グループ化";
    case 4:
      return "1-4 ステルス投票";
    case 5:
      return "1-5 結果集計・絞り込み";
    default:
      return `フェーズ${phase.phase}・ステップ${phase.step}`;
  }
}

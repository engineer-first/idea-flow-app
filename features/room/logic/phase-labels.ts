import type { Phase } from "@/contracts/room-protocol";

// フェーズの表示ラベル。ヘッダーの現在フェーズ表示と、フェーズ移行の
// 確認ダイアログの説明文が共有するため logic に置く（文言は定数）。
export const PHASE_LABELS: Record<Phase, string> = {
  lobby: "開始待ち",
  phase1: "フェーズ1",
  phase2: "フェーズ2",
  phase3: "フェーズ3",
  phase4: "フェーズ4（投票結果）",
};

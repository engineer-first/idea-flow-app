// ボード定数はコントラクト層（contracts/board.ts）へ移動した。
// UI コンポーネント（board-view / note-card）の import を変えないための再エクスポート。
export {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DRAG_BROADCAST_THROTTLE_MS,
  DRAG_THRESHOLD_PX,
  NOTE_HEIGHT,
  NOTE_WIDTH,
} from "@/contracts/board";

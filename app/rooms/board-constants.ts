// ボードのレイアウトに関する定数。サーバー側(actions.ts のzod検証)と
// クライアント側(board-view.tsx / note-card.tsx)の両方から参照し、
// 値がズレて「サーバーでは弾かれるがUI上はドラッグできてしまう」ような
// 不整合が起きないようにする。
export const BOARD_WIDTH = 2000;
export const BOARD_HEIGHT = 1200;

export const NOTE_WIDTH = 200;
export const NOTE_HEIGHT = 150;

// ドラッグ中のnote-drag broadcastを間引く間隔（ミリ秒）。
export const DRAG_BROADCAST_THROTTLE_MS = 80;

// pointerdownからこの距離(px)を超えて動いたらドラッグとみなす閾値。
// クリック（選択・編集開始）とドラッグ（移動）を同じポインター操作から
// 区別するために必要。tldrawのドラッグ判定距離に合わせて4pxにしている。
export const DRAG_THRESHOLD_PX = 4;

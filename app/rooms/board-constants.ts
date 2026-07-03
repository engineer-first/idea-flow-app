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

// ルーム内の付箋（Note）配列に対して、RoomDO から届く ServerMessage
// （contracts/room-protocol.ts）を適用する純粋関数群。
//
// 「自分がドラッグ中の付箋」については、他クライアント（＝自分自身のエコーを含む）
// からの位置更新を無視し、ローカルの操作を優先する。そうしないと、ドラッグ中に
// 古い位置を運ぶ note:updated/note:drag イベントを受信した瞬間に付箋が
// 巻き戻って見えてしまう。
import type { ProtocolNote, ServerMessage } from "@/contracts/room-protocol";

// アプリケーションで扱うドメインモデル。プロトコル上の付箋と同一の形なので
// contracts の型をそのまま再エクスポートする（重複定義を避ける）。
export type Note = ProtocolNote;

export type ApplyServerMessageOptions = {
  // 現在ローカルでドラッグ操作中の付箋ID（ドラッグしていなければ null）。
  draggingNoteId: string | null;
};

export function applyServerMessage(
  notes: Note[],
  message: ServerMessage,
  options: ApplyServerMessageOptions,
): Note[] {
  switch (message.type) {
    case "snapshot": {
      // 接続・再接続時の一括復元。確定状態はサーバーが真実なので、
      // ドラッグ中でも丸ごと置き換える。
      return message.notes;
    }

    case "note:inserted": {
      const exists = notes.some((n) => n.id === message.note.id);
      if (!exists) {
        return [...notes, message.note];
      }
      return notes.map((n) => (n.id === message.note.id ? message.note : n));
    }

    case "note:updated": {
      return notes.map((n) => {
        if (n.id !== message.note.id) {
          return n;
        }
        if (options.draggingNoteId === n.id) {
          // 自分がドラッグ中の位置はローカル優先で保持し、他フィールドのみ反映する。
          return { ...message.note, x: n.x, y: n.y };
        }
        return message.note;
      });
    }

    case "note:deleted": {
      return notes.filter((n) => n.id !== message.noteId);
    }

    case "note:drag": {
      if (options.draggingNoteId === message.noteId) {
        // 自分自身のドラッグ操作を優先し、エコーを無視する。
        return notes;
      }
      return notes.map((n) =>
        n.id === message.noteId ? { ...n, x: message.x, y: message.y } : n,
      );
    }

    case "error": {
      // 通知・ログはコンテナ（room-board.tsx）の責務。ここでは状態を変えない。
      return notes;
    }

    case "group:updated":
    case "group:deleted": {
      // グループの同期は RoomBoard 側で管理するため、ここでは付箋状態を変えない。
      return notes;
    }

    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}

// 自分自身のドラッグ操作をローカルへ即時反映するための純粋関数。
// サーバーへの確定（note:move）を待たず、操作の追従性を優先する。
export function moveNoteLocally(
  notes: Note[],
  noteId: string,
  x: number,
  y: number,
): Note[] {
  return notes.map((n) => (n.id === noteId ? { ...n, x, y } : n));
}

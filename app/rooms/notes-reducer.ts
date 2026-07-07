// ルーム内の付箋（Note）配列に対して、Realtime 経由で届くイベントを適用する
// 純粋関数群。DB由来の broadcast_changes イベント（INSERT/UPDATE/DELETE）と、
// ドラッグ中の一時的な位置共有イベント（DRAG、DBには書き込まない）の両方を
// 同じ reducer で扱う。
//
// 「自分がドラッグ中の付箋」については、他クライアント（＝自分自身のエコーを含む）
// からの位置更新を無視し、ローカルの操作を優先する。そうしないと、ドラッグ中に
// 古い位置を運ぶ UPDATE/DRAG イベントを受信した瞬間に付箋が巻き戻って見えてしまう。

// アプリケーションで扱うドメインモデル（camelCase）。
export type Note = {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
};

// realtime.broadcast_changes トリガー由来のイベントと、
// クライアント発のドラッグ中イベントを共通の判別可能ユニオンで表現する。
export type NoteChangeEvent =
  | { operation: "INSERT"; record: Note; oldRecord: Note | null }
  | { operation: "UPDATE"; record: Note; oldRecord: Note | null }
  | { operation: "DELETE"; record: null; oldRecord: Note }
  | { operation: "DRAG"; noteId: string; x: number; y: number };

export type ApplyNoteEventOptions = {
  // 現在ローカルでドラッグ操作中の付箋ID（ドラッグしていなければ null）。
  draggingNoteId: string | null;
};

export function applyNoteEvent(
  notes: Note[],
  event: NoteChangeEvent,
  options: ApplyNoteEventOptions,
): Note[] {
  switch (event.operation) {
    case "INSERT": {
      const exists = notes.some((n) => n.id === event.record.id);
      if (!exists) {
        return [...notes, event.record];
      }
      return notes.map((n) => (n.id === event.record.id ? event.record : n));
    }

    case "UPDATE": {
      return notes.map((n) => {
        if (n.id !== event.record.id) {
          return n;
        }
        if (options.draggingNoteId === n.id) {
          // 自分がドラッグ中の位置はローカル優先で保持し、他フィールドのみ反映する。
          return { ...event.record, x: n.x, y: n.y };
        }
        return event.record;
      });
    }

    case "DELETE": {
      return notes.filter((n) => n.id !== event.oldRecord.id);
    }

    case "DRAG": {
      if (options.draggingNoteId === event.noteId) {
        // 自分自身のドラッグ操作を優先し、エコーを無視する。
        return notes;
      }
      return notes.map((n) =>
        n.id === event.noteId ? { ...n, x: event.x, y: event.y } : n,
      );
    }

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

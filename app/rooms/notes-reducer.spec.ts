import { describe, expect, it } from "vitest";
import { applyNoteEvent, type Note } from "@/app/rooms/notes-reducer";

const note: Note = {
  id: "note-1",
  roomId: "room-1",
  authorId: "user-1",
  content: "hello",
  x: 10,
  y: 20,
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z",
};

function makeNote(overrides: Partial<Note> = {}): Note {
  return { ...note, ...overrides };
}

describe("applyNoteEvent", () => {
  it("INSERTイベントで新しい付箋を追加する", () => {
    const result = applyNoteEvent(
      [],
      { operation: "INSERT", record: note, oldRecord: null },
      { draggingNoteId: null },
    );

    expect(result).toEqual([note]);
  });

  it("INSERTイベントで既に同じIDの付箋があれば置き換える（冪等）", () => {
    const existing = makeNote({ content: "old" });
    const incoming = makeNote({ content: "new" });

    const result = applyNoteEvent(
      [existing],
      { operation: "INSERT", record: incoming, oldRecord: null },
      { draggingNoteId: null },
    );

    expect(result).toEqual([incoming]);
  });

  it("UPDATEイベントで既存の付箋を更新する", () => {
    const existing = makeNote({ content: "old", x: 0, y: 0 });
    const updated = makeNote({ content: "new", x: 50, y: 60 });

    const result = applyNoteEvent(
      [existing],
      { operation: "UPDATE", record: updated, oldRecord: existing },
      { draggingNoteId: null },
    );

    expect(result).toEqual([updated]);
  });

  it("自分がドラッグ中の付箋に対するUPDATEは位置(x, y)を無視し、他フィールドのみ反映する", () => {
    const existing = makeNote({ content: "old", x: 100, y: 100 });
    // サーバーからの反射（エコー）が古い位置を運んでくる想定
    const echoed = makeNote({ content: "new-content", x: 0, y: 0 });

    const result = applyNoteEvent(
      [existing],
      { operation: "UPDATE", record: echoed, oldRecord: existing },
      { draggingNoteId: "note-1" },
    );

    expect(result).toEqual([
      makeNote({ content: "new-content", x: 100, y: 100 }),
    ]);
  });

  it("DELETEイベントで付箋を取り除く", () => {
    const existing = makeNote();

    const result = applyNoteEvent(
      [existing],
      { operation: "DELETE", record: null, oldRecord: existing },
      { draggingNoteId: null },
    );

    expect(result).toEqual([]);
  });

  it("DRAGイベントで対象付箋の位置のみ更新する", () => {
    const existing = makeNote({ x: 0, y: 0 });

    const result = applyNoteEvent(
      [existing],
      { operation: "DRAG", noteId: "note-1", x: 42, y: 84 },
      { draggingNoteId: null },
    );

    expect(result).toEqual([makeNote({ x: 42, y: 84 })]);
  });

  it("自分がドラッグ中の付箋に対するDRAGイベントは無視する（自分の操作を優先）", () => {
    const existing = makeNote({ x: 100, y: 100 });

    const result = applyNoteEvent(
      [existing],
      { operation: "DRAG", noteId: "note-1", x: 42, y: 84 },
      { draggingNoteId: "note-1" },
    );

    expect(result).toEqual([existing]);
  });

  it("存在しない付箋IDへのDRAG/UPDATE/DELETEは何もしない", () => {
    const existing = makeNote();

    const dragResult = applyNoteEvent(
      [existing],
      { operation: "DRAG", noteId: "unknown", x: 1, y: 1 },
      { draggingNoteId: null },
    );
    expect(dragResult).toEqual([existing]);

    const deleteResult = applyNoteEvent(
      [existing],
      {
        operation: "DELETE",
        record: null,
        oldRecord: makeNote({ id: "unknown" }),
      },
      { draggingNoteId: null },
    );
    expect(deleteResult).toEqual([existing]);
  });
});

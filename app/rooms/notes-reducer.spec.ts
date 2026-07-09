import { describe, expect, it } from "vitest";
import {
  applyServerMessage,
  moveNoteLocally,
  type Note,
} from "@/app/rooms/notes-reducer";
import type { ServerMessage } from "@/contracts/room-protocol";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const note: Note = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  authorId: USER_ID,
  content: "hello",
  x: 10,
  y: 20,
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z",
};

function makeNote(overrides: Partial<Note> = {}): Note {
  return { ...note, ...overrides };
}

describe("applyServerMessage", () => {
  it("snapshotで付箋を丸ごと置き換える", () => {
    const message: ServerMessage = {
      type: "snapshot",
      notes: [note],
      members: [],
      phase: "lobby",
    };

    const result = applyServerMessage([], message, { draggingNoteId: null });

    expect(result).toEqual([note]);
  });

  it("snapshotはドラッグ中でも丸ごと上書きする", () => {
    const existing = makeNote({ x: 100, y: 100 });
    const snapshotNote = makeNote({ x: 0, y: 0 });
    const message: ServerMessage = {
      type: "snapshot",
      notes: [snapshotNote],
      members: [],
      phase: "lobby",
    };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: note.id,
    });

    expect(result).toEqual([snapshotNote]);
  });

  it("note:insertedで新しい付箋を追加する", () => {
    const message: ServerMessage = { type: "note:inserted", note };

    const result = applyServerMessage([], message, { draggingNoteId: null });

    expect(result).toEqual([note]);
  });

  it("note:insertedで既に同じIDの付箋があれば置き換える（冪等）", () => {
    const existing = makeNote({ content: "old" });
    const incoming = makeNote({ content: "new" });
    const message: ServerMessage = { type: "note:inserted", note: incoming };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: null,
    });

    expect(result).toEqual([incoming]);
  });

  it("note:updatedで既存の付箋を更新する", () => {
    const existing = makeNote({ content: "old", x: 0, y: 0 });
    const updated = makeNote({ content: "new", x: 50, y: 60 });
    const message: ServerMessage = { type: "note:updated", note: updated };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: null,
    });

    expect(result).toEqual([updated]);
  });

  it("自分がドラッグ中の付箋に対するnote:updatedは位置(x, y)を無視し、他フィールドのみ反映する", () => {
    const existing = makeNote({ content: "old", x: 100, y: 100 });
    // サーバーからの反射（エコー）が古い位置を運んでくる想定
    const echoed = makeNote({ content: "new-content", x: 0, y: 0 });
    const message: ServerMessage = { type: "note:updated", note: echoed };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: note.id,
    });

    expect(result).toEqual([
      makeNote({ content: "new-content", x: 100, y: 100 }),
    ]);
  });

  it("note:deletedで付箋を取り除く", () => {
    const existing = makeNote();
    const message: ServerMessage = {
      type: "note:deleted",
      noteId: existing.id,
    };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: null,
    });

    expect(result).toEqual([]);
  });

  it("note:dragで対象付箋の位置のみ更新する", () => {
    const existing = makeNote({ x: 0, y: 0 });
    const message: ServerMessage = {
      type: "note:drag",
      noteId: existing.id,
      x: 42,
      y: 84,
    };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: null,
    });

    expect(result).toEqual([makeNote({ x: 42, y: 84 })]);
  });

  it("自分がドラッグ中の付箋に対するnote:dragイベントは無視する（自分の操作を優先）", () => {
    const existing = makeNote({ x: 100, y: 100 });
    const message: ServerMessage = {
      type: "note:drag",
      noteId: existing.id,
      x: 42,
      y: 84,
    };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: existing.id,
    });

    expect(result).toEqual([existing]);
  });

  it("存在しない付箋IDへのnote:drag/note:updated/note:deletedは何もしない", () => {
    const existing = makeNote();

    const dragResult = applyServerMessage(
      [existing],
      { type: "note:drag", noteId: "unknown", x: 1, y: 1 },
      { draggingNoteId: null },
    );
    expect(dragResult).toEqual([existing]);

    const updateResult = applyServerMessage(
      [existing],
      { type: "note:updated", note: makeNote({ id: "unknown" }) },
      { draggingNoteId: null },
    );
    expect(updateResult).toEqual([existing]);

    const deleteResult = applyServerMessage(
      [existing],
      { type: "note:deleted", noteId: "unknown" },
      { draggingNoteId: null },
    );
    expect(deleteResult).toEqual([existing]);
  });

  it("errorメッセージはnotesをそのまま返す（副作用はコンテナの責務）", () => {
    const existing = makeNote();
    const message: ServerMessage = {
      type: "error",
      code: "forbidden",
      message: "この操作を行う権限がありません。",
    };

    const result = applyServerMessage([existing], message, {
      draggingNoteId: null,
    });

    expect(result).toEqual([existing]);
  });
});

describe("moveNoteLocally", () => {
  it("指定した付箋の位置を更新する", () => {
    const existing = makeNote({ x: 0, y: 0 });

    const result = moveNoteLocally([existing], existing.id, 42, 84);

    expect(result).toEqual([makeNote({ x: 42, y: 84 })]);
  });

  it("存在しない付箋IDを指定した場合は何もしない", () => {
    const existing = makeNote();

    const result = moveNoteLocally([existing], "unknown", 1, 1);

    expect(result).toEqual([existing]);
  });
});

import type { Note } from "@/app/rooms/notes-reducer";

// NoteCard の spec / stories で共有するテストデータビルダー。
// コンポーネントファイル内に生のテストデータを持ち込まないための置き場所。
export function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    roomId: "room-1",
    authorId: "user-1",
    content: "付箋の本文",
    x: 100,
    y: 120,
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    ...overrides,
  };
}

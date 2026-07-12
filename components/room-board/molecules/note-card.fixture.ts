import type { Note } from "@/app/rooms/notes-reducer";

// RoomBoard/NoteCard の spec / stories で共有するテストデータビルダー。
// コンポーネントファイル内に生のテストデータを持ち込まないための置き場所。
export function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    authorId: "user-1",
    content: "付箋の本文",
    visibility: "shared",
    color: "yellow",
    x: 100,
    y: 120,
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    dotVotes: {
      subjective: { count: 0, votedByMe: false, ownCount: 0 },
      objective: { count: 0, votedByMe: false, ownCount: 0 },
    },
    ...overrides,
  };
}

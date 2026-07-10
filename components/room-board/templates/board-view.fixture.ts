import type { Note } from "@/app/rooms/notes-reducer";
import { buildNote } from "@/components/room-board/molecules/note-card.fixture";

// BoardView の spec / stories で共有するテストデータ。
export function buildNotes(count = 3): Note[] {
  return Array.from({ length: count }, (_, index) =>
    buildNote({
      id: `note-${index + 1}`,
      content: `付箋 ${index + 1}`,
      x: 80 + index * 40,
      y: 60 + index * 40,
    }),
  );
}

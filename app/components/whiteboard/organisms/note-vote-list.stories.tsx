import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { NoteTarget, VoteRecord } from "../types";
import { NoteVoteList } from "./note-vote-list";

const noteTargets: NoteTarget[] = [
  {
    noteId: "shape:note-1",
    title: "顧客インタビューから課題を抽出する",
    bounds: { left: 120, top: 80, width: 220, height: 140 },
  },
  {
    noteId: "shape:note-2",
    title: "解決策の仮説を整理する",
    bounds: { left: 380, top: 160, width: 220, height: 140 },
  },
];

const votes: VoteRecord[] = [
  {
    id: "vote-1",
    userId: "user-1",
    stickyNoteId: "shape:note-1",
    voteType: "subjective",
    createdAt: "2026-07-07T00:00:00.000Z",
  },
  {
    id: "vote-2",
    userId: "user-1",
    stickyNoteId: "shape:note-1",
    voteType: "objective",
    createdAt: "2026-07-07T00:00:00.000Z",
  },
];

const meta = {
  component: NoteVoteList,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof NoteVoteList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    draggedVoteId: null,
    dragOverNoteId: null,
    noteTargets,
    votes,
    onDragOverNoteChange: () => undefined,
    onMoveVoteToNote: () => undefined,
    onRemoveVote: () => undefined,
    onVoteDragEnd: () => undefined,
    onVoteDragStart: () => undefined,
  },
  render: (args) => {
    const [dragOverNoteId, setDragOverNoteId] = useState<string | null>(null);
    const [draggedVoteId, setDraggedVoteId] = useState<string | null>(null);

    return (
      <NoteVoteList
        draggedVoteId={draggedVoteId}
        dragOverNoteId={dragOverNoteId}
        noteTargets={args.noteTargets}
        votes={args.votes}
        onDragOverNoteChange={setDragOverNoteId}
        onMoveVoteToNote={args.onMoveVoteToNote}
        onRemoveVote={args.onRemoveVote}
        onVoteDragEnd={() => setDraggedVoteId(null)}
        onVoteDragStart={setDraggedVoteId}
      />
    );
  },
};

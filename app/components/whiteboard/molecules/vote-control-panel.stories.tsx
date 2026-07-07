import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { NoteTarget, VoteRecord, VoteType } from "../types";
import { VoteControlPanel } from "./vote-control-panel";

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
    stickyNoteId: "shape:note-2",
    voteType: "objective",
    createdAt: "2026-07-07T00:00:00.000Z",
  },
];

const meta = {
  component: VoteControlPanel,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof VoteControlPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeMode: "subjective",
    feedback: "主観ドットを配置しました。",
    noteTargets,
    remaining: { subjective: 0, objective: 2 },
    selectedNoteId: noteTargets[0].noteId,
    votes,
    onActiveModeChange: () => undefined,
    onRemoveVoteType: () => undefined,
    onSelectedNoteChange: () => undefined,
    onVote: () => undefined,
  },
  render: (args) => {
    const [activeMode, setActiveMode] = useState<VoteType | null>("subjective");
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
      noteTargets[0].noteId,
    );

    return (
      <VoteControlPanel
        activeMode={activeMode}
        feedback={args.feedback}
        noteTargets={args.noteTargets}
        remaining={args.remaining}
        selectedNoteId={selectedNoteId}
        votes={args.votes}
        onActiveModeChange={setActiveMode}
        onRemoveVoteType={args.onRemoveVoteType}
        onSelectedNoteChange={setSelectedNoteId}
        onVote={args.onVote}
      />
    );
  },
};

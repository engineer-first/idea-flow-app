import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { NoteTarget, VoteRecord } from "../types";
import { VoteCanvasOverlay } from "./vote-canvas-overlay";

const noteTargets: NoteTarget[] = [
  {
    noteId: "shape:note-1",
    title: "顧客インタビューから課題を抽出する",
    bounds: { left: 64, top: 48, width: 220, height: 140 },
  },
  {
    noteId: "shape:note-2",
    title: "解決策の仮説を整理する",
    bounds: { left: 320, top: 180, width: 220, height: 140 },
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
  component: VoteCanvasOverlay,
  decorators: [
    (Story) => (
      <div style={{ position: "relative", width: 640, height: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VoteCanvasOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    noteTargets,
    votes,
  },
};

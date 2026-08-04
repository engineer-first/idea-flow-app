import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DotVoteControls } from "./dot-vote-controls";

const meta = {
  title: "DotVote/DotVoteControls",
  component: DotVoteControls,
  args: {
    noteId: "note-1",
    dotVotes: {
      subjective: { count: 1, votedByMe: false, ownCount: 0 },
      objective: { count: 2, votedByMe: true, ownCount: 2 },
    },
    voteRemaining: { subjective: 1, objective: 2 },
    disabled: false,
    onVote: () => {},
    onVoteReset: () => {},
  },
} satisfies Meta<typeof DotVoteControls>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LimitReached: Story = {
  args: {
    voteRemaining: { subjective: 0, objective: 0 },
  },
};

export const StealthVoting: Story = {
  args: {
    dotVotes: {
      subjective: { votedByMe: true, ownCount: 1 },
      objective: { votedByMe: true, ownCount: 3 },
    },
    voteRemaining: { subjective: 0, objective: 0 },
  },
};

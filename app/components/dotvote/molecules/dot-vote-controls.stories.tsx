import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DotVoteControls } from "@/app/components/dotvote/molecules/dot-vote-controls";

const meta = {
  title: "DotVote/Molecules/DotVoteControls",
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

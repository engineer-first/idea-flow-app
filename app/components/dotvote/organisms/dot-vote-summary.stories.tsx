import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DotVoteSummary } from "@/app/components/dotvote/organisms/dot-vote-summary";

const meta = {
  title: "DotVote/Organisms/DotVoteSummary",
  component: DotVoteSummary,
  args: {
    voteRemaining: { subjective: 1, objective: 3 },
  },
} satisfies Meta<typeof DotVoteSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Spent: Story = {
  args: {
    voteRemaining: { subjective: 0, objective: 0 },
  },
};

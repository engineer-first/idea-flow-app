import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DotVoteSummary } from "./dot-vote-summary";

const meta = {
  title: "DotVote/DotVoteSummary",
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

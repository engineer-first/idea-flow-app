import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DotVoteButton } from "./dot-vote-button";

const meta = {
  title: "DotVote/DotVoteButton",
  component: DotVoteButton,
  args: {
    kind: "subjective",
    count: 1,
    votedByMe: false,
    disabled: false,
    onClick: () => {},
  },
} satisfies Meta<typeof DotVoteButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Subjective: Story = {};

export const ObjectiveVoted: Story = {
  args: {
    kind: "objective",
    count: 3,
    votedByMe: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

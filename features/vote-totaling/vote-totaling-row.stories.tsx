import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VoteTotalingRow } from "./vote-totaling-row";

const meta = {
  title: "VoteTotaling/VoteTotalingRow",
  component: VoteTotalingRow,
  args: {
    rank: 1,
    row: {
      noteId: "note-1",
      content: "初学者が作るものを決められない",
      subjectiveCount: 2,
      objectiveCount: 1,
      score: 11,
      isSelectedChallenge: true,
    },
  },
} satisfies Meta<typeof VoteTotalingRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selected: Story = {};
export const Ranked: Story = {
  args: {
    rank: 2,
    row: {
      noteId: "note-2",
      content: "役割分担が曖昧になる",
      subjectiveCount: 0,
      objectiveCount: 5,
      score: 5,
      isSelectedChallenge: false,
    },
  },
};

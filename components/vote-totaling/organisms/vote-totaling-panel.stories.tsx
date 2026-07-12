import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";
import { buildNotes } from "@/components/room-board/templates/board-view.fixture";
import { VoteTotalingPanel } from "@/components/vote-totaling/organisms/vote-totaling-panel";

const ME = "11111111-1111-4111-8111-111111111111";
const meta = {
  title: "VoteTotaling/Organisms/VoteTotalingPanel",
  component: VoteTotalingPanel,
  args: {
    members: buildMembers(2, ME),
    notes: buildNotes(3).map((note, index) => ({
      ...note,
      dotVotes: {
        subjective: {
          count: index === 0 ? 2 : 0,
          votedByMe: false,
          ownCount: 0,
        },
        objective: {
          count: index === 0 ? 1 : 5,
          votedByMe: false,
          ownCount: 0,
        },
      },
    })),
  },
} satisfies Meta<typeof VoteTotalingPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const Waiting: Story = { args: { notes: buildNotes(1) } };

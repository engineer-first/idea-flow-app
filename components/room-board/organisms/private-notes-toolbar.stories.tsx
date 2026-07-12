import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PrivateNotesToolbar } from "@/components/room-board/organisms/private-notes-toolbar";
import { buildNote } from "@/contracts/room-protocol.fixture";

const meta = {
  title: "RoomBoard/Organisms/PrivateNotesToolbar",
  component: PrivateNotesToolbar,
  args: {
    notes: [
      buildNote({
        visibility: "private",
        content: "利用者の困りごとを書き出す",
      }),
      buildNote({
        id: "note-2",
        visibility: "private",
        content: "別の視点も考える",
      }),
    ],
    disabled: false,
    selectedNoteId: null,
    onSelect: fn(),
    onAdd: fn(),
    onContentChange: fn(),
    onDelete: fn(),
    onDragStart: fn(),
  },
} satisfies Meta<typeof PrivateNotesToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = {
  args: { notes: [] },
};

export const Disconnected: Story = {
  args: { disabled: true },
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { NoteCard } from "@/app/rooms/[id]/note-card";
import { buildNote } from "@/app/rooms/[id]/note-card.fixture";

const meta = {
  title: "Rooms/NoteCard",
  component: NoteCard,
  parameters: {
    layout: "padded",
  },
  args: {
    note: buildNote(),
    isOwnDrag: false,
    onDragStart: fn(),
    onDragMove: fn(),
    onDragEnd: fn(),
    onContentChange: fn(),
    onDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", width: 400, height: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    note: buildNote({ content: "" }),
  },
};

export const LongContent: Story = {
  args: {
    note: buildNote({
      content:
        "長めのメモの例です。付箋の高さに収まらない場合はスクロールして読めるようにしています。",
    }),
  },
};

export const Dragging: Story = {
  args: {
    isOwnDrag: true,
  },
};

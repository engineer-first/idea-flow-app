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
    isSelected: false,
    onSelect: fn(),
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

// 選択状態: 青い枠が付き、Backspace/Deleteで削除・もう一度クリックで編集に入れる。
export const Selected: Story = {
  args: {
    isSelected: true,
  },
};

// 自分がドラッグ中: 「持ち上げた」表現として影が深くなる。
export const Dragging: Story = {
  args: {
    isSelected: true,
    isOwnDrag: true,
  },
};

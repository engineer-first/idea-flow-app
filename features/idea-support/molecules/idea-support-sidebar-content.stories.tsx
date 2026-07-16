import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { IdeaSupportSidebarContent } from "./idea-support-sidebar-content";

const meta = {
  title: "IdeaSupport/IdeaSupportSidebarContent",
  component: IdeaSupportSidebarContent,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 400,
          height: 500,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IdeaSupportSidebarContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

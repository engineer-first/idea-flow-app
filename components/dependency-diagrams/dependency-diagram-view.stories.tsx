import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DependencyDiagramView } from "./dependency-diagram-view";
import { SAMPLE_DIAGRAM_SVG } from "./dependency-diagram-view.fixture";

const meta: Meta<typeof DependencyDiagramView> = {
  title: "Dependencies/DependencyDiagramView",
  component: DependencyDiagramView,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    title: "notes",
    description: "notes feature 内のファイルレベル依存図（サンプル）。",
  },
};

export default meta;
type Story = StoryObj<typeof DependencyDiagramView>;

export const Loading: Story = {
  args: { state: { kind: "loading" } },
};

export const Success: Story = {
  args: { state: { kind: "success", svg: SAMPLE_DIAGRAM_SVG } },
};

export const LoadError: Story = {
  args: { state: { kind: "error", message: "HTTP 404" } },
};

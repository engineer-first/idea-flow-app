import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Input",
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ padding: 24, width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Input placeholder="メールアドレス" />,
};

export const WithField: Story = {
  render: () => (
    <Field>
      <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
      <Input id="email" type="email" placeholder="you@example.com" />
      <FieldDescription>公開されません</FieldDescription>
    </Field>
  ),
};

export const Disabled: Story = {
  render: () => <Input disabled placeholder="無効" />,
};

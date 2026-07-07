import type { Meta, StoryObj } from "@storybook/react";
import LoginCard from "./login-card";

const meta: Meta<typeof LoginCard> = {
  title: "Pages/LoginCard",
  component: LoginCard,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    googleAction: async () => {},
    passwordAction: async () => {},
  },
};

export default meta;
type Story = StoryObj<typeof LoginCard>;

export const Default: Story = {
  args: {
    isConfigured: true,
    showDevAuth: false,
  },
};

export const WithError: Story = {
  args: {
    isConfigured: true,
    showDevAuth: false,
    error: "Google認証中にエラーが発生しました。もう一度お試しください。",
  },
};

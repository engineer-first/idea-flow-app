import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      defaultValue: "light",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
      return <Story />;
    },
  ],
  async beforeAll() {
    if (typeof window === "undefined") return;
    if (process.env.NEXT_PUBLIC_USE_MSW !== "true") return;
    const { worker } = await import("../app/mocks/browser");
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: true,
      waitUntilReady: true,
    });
  },
};

export default preview;

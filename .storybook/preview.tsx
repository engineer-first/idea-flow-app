import { withThemeByClassName } from "@storybook/addon-themes";
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
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
    }),
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

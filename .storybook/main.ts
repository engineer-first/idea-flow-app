import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: [
    "../app/**/*.stories.@(ts|tsx)",
    "../components/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-themes", "@storybook/addon-docs"],
  staticDirs: ["../public"],
  viteFinal: (config) => ({
    ...config,
    envPrefix: ["VITE_", "STORYBOOK_", "NEXT_PUBLIC_"],
  }),
};

export default config;

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "app/**/*.{test,spec}.{ts,tsx}",
      "lib/**/*.{test,spec}.{ts,tsx}",
      "contracts/**/*.{test,spec}.{ts,tsx}",
      "components/**/*.{test,spec}.{ts,tsx}",
      ".claude/hooks/**/*.spec.ts",
      ".github/scripts/**/*.spec.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: [
        "app/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "contracts/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.{test,spec}.{ts,tsx}"],
    },
  },
});

// Durable Object / Worker のテスト用 Vitest 設定。
// アプリ側 (jsdom) の vitest.config.mts とは実行環境が異なるため分離する。
// vitest-pool-workers 0.18 (Vitest 4 対応) からは defineWorkersConfig ではなく
// cloudflareTest プラグインで構成する。
// 実行: npm run test:workers
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations("./workers/migrations");

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./workers/wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
        },
      },
    }),
  ],
  test: {
    include: ["workers/**/*.spec.ts"],
    setupFiles: ["./workers/test-setup.ts"],
  },
});

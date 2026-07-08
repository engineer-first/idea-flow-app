// workers テストの前処理: D1 に migration を適用する。
// TEST_MIGRATIONS は vitest.workers.config.mts の readD1Migrations で注入される
// テスト専用バインディングのため、生成された Env 型をここで拡張する。
import { applyD1Migrations, type D1Migration, env } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      // テスト実行時のみ存在する（optional にしないと本番 Env 型が汚染される）
      TEST_MIGRATIONS?: D1Migration[];
    }
  }
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS ?? []);

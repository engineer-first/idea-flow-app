// 本番用のカスタム Worker エントリ。
// /api/* をサービスバインディング経由で api-worker へ転送し、
// それ以外を OpenNext が生成した Next.js ハンドラへ渡す。
// これによりブラウザからは同一オリジンの /api/... で api-worker
// （WebSocket を含む）へ到達でき、Cookie がそのまま流れる。
//
// 注意: .open-next/worker.js は `npm run build:cf` 時に生成されるため、
// このファイルは workers/tsconfig.json の型検査から除外している
// （wrangler が bundle 時に解決する）。

// @ts-expect-error -- ビルド時生成物のため型解決できない
import nextHandler from "../.open-next/worker.js";

type AppWorkerEnv = {
  API_WORKER: { fetch: typeof fetch };
};

export default {
  async fetch(
    request: Request,
    env: AppWorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return env.API_WORKER.fetch(request);
    }
    return nextHandler.fetch(request, env, ctx);
  },
};

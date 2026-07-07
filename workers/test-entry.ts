// vitest-pool-workers 用のテストエントリ。
// 本番エントリ (app-worker.ts) は OpenNext 生成物に依存するため、
// テストでは RoomDO とルーティングだけを持つこの軽量エントリを main にする。
export { RoomDO } from "./room-do";

const ROOM_WS_PATTERN = /^\/api\/rooms\/([^/]+)\/ws$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(ROOM_WS_PATTERN);
    if (match?.[1]) {
      const stub = env.ROOM_DO.get(env.ROOM_DO.idFromName(match[1]));
      return stub.fetch(request);
    }
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

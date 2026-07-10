// 疎通確認専用エンドポイント。認証・認可には関与しない。
// スモークテスト（scripts/smoke-test.sh）がこれを叩き、
// ブラウザ -> Next.js Worker -> サービスバインディング -> api-worker
// の経路全体が生きているかを確認する。
import { apiFetch } from "@/lib/api-client";

export async function GET(): Promise<Response> {
  try {
    const res = await apiFetch("/api/health");
    return new Response(await res.text(), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ルーム WebSocket の接続先 URL を解決する。
// - ローカル開発: NEXT_PUBLIC_API_WORKER_URL（例: http://localhost:8787）
// - 本番（Cloudflare 同一オリジン配備）: 未設定のまま現在のオリジンを使い、
//   /api/* がカスタム Worker 経由で api-worker へ転送される
export function roomWebSocketUrl(
  roomId: string,
  options?: { base?: string; origin?: string },
): string {
  const base = options?.base ?? process.env.NEXT_PUBLIC_API_WORKER_URL ?? "";
  const origin =
    options?.origin ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const url = new URL(`/api/rooms/${roomId}/ws`, base || origin);
  url.protocol =
    url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  return url.toString();
}

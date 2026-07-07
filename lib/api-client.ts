// Next サーバー側から api-worker を呼ぶための唯一の入口。
// - ローカル開発: API_WORKER_URL (npm run dev:api のワーカー) へ HTTP で到達する
// - Cloudflare 上: サービスバインディング API_WORKER 経由で到達する
// 現在のリクエストのセッション Cookie を転送するため、api-worker 側では
// 呼び出したユーザー本人として認可される。
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/contracts/session";

type FetcherLike = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

function getServiceBinding(): FetcherLike | null {
  try {
    const { env } = getCloudflareContext();
    const binding = (env as { API_WORKER?: FetcherLike }).API_WORKER;
    return binding ?? null;
  } catch {
    // Cloudflare コンテキスト外（通常の next dev）では利用できない。
    return null;
  }
}

// api-worker が無応答のとき、呼び出し元の Server Action（createRoom 等）が
// 無期限にブロックされないよう、外部呼び出しには必ず上限時間を設ける。
const DEFAULT_TIMEOUT_MS = 10_000;

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const headers = new Headers(init?.headers);
  if (sessionToken) {
    headers.set("Cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
  }

  const signal = init?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);

  const baseUrl = process.env.API_WORKER_URL;
  if (baseUrl) {
    return fetch(new URL(path, baseUrl), { ...init, headers, signal });
  }

  const binding = getServiceBinding();
  if (binding) {
    // サービスバインディングはフル URL を要求するが、ホスト名は使われない。
    return binding.fetch(`https://api-worker.internal${path}`, {
      ...init,
      headers,
      signal,
    });
  }

  throw new Error(
    "API_WORKER_URL が未設定です。ローカル開発では `npm run dev:api` を起動し、.env.local に API_WORKER_URL=http://localhost:8787 を設定してください。",
  );
}

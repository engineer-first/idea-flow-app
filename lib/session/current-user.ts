// 現在のログインユーザーの取得（lib/supabase/auth.ts の後継）。
// セッション Cookie のトークンを検証し、ペイロードをそのまま返す。
// Next 公式ドキュメントの推奨（Proxy に頼らず各 Server Function 内で検証する）
// に従い、認証が必要な箇所は毎回この関数を通す。
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  type SessionPayload,
  SessionPayloadSchema,
  TOKEN_AUDIENCE,
} from "@/contracts/session";
import { getSessionSecret, isAuthConfigured } from "@/lib/session/env";
import { verifyToken } from "@/lib/session/token";

export async function getCurrentUser(): Promise<SessionPayload | null> {
  if (!isAuthConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifyToken(token, SessionPayloadSchema, {
    secret: getSessionSecret(),
    audience: TOKEN_AUDIENCE.session,
  });
}

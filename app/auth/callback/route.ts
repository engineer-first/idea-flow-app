// Google OIDC authorization code flow のコールバック。
// 1. state を一時 Cookie と照合（CSRF 防止）
// 2. code をトークンエンドポイントで交換
// 3. id_token を Google の JWKS で検証し、nonce を照合
// 4. establishSession でユーザー upsert + セッション Cookie 発行
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isEmailVerified, sanitizeNextPath } from "@/features/auth";
import { OAUTH_STATE_COOKIE } from "@/lib/session/cookie";
import {
  getBaseUrl,
  getGoogleClientId,
  getGoogleClientSecret,
  isGoogleAuthConfigured,
} from "@/lib/session/env";
import { establishSession } from "@/lib/session/establish";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const OauthStateSchema = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  next: z.string().optional(),
});

const GoogleClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  nonce: z.string().optional(),
});

function redirectToLogin(origin: string, message: string): NextResponse {
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(message)}`,
  );
}

function parseOauthStateCookie(
  value: string | undefined,
): z.infer<typeof OauthStateSchema> | null {
  if (!value) return null;
  try {
    const parsed = OauthStateSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { origin, searchParams } = request.nextUrl;

  if (!isGoogleAuthConfigured()) {
    return redirectToLogin(
      origin,
      "Google ログインの環境変数を設定してください。",
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const oauthState = parseOauthStateCookie(
    cookieStore.get(OAUTH_STATE_COOKIE)?.value,
  );
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !oauthState || state !== oauthState.state) {
    return redirectToLogin(origin, "ログインをやり直してください。");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: `${getBaseUrl()}/auth/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    console.error("Google token exchange failed:", tokenResponse.status);
    return redirectToLogin(origin, "ログインに失敗しました。");
  }

  const { id_token: idToken } = (await tokenResponse.json()) as {
    id_token?: string;
  };
  if (!idToken) {
    return redirectToLogin(origin, "ログインに失敗しました。");
  }

  let claims: z.infer<typeof GoogleClaimsSchema>;
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: getGoogleClientId(),
    });
    const parsed = GoogleClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("unexpected id_token claims");
    }
    claims = parsed.data;
  } catch (error) {
    console.error("Failed to verify Google id_token:", error);
    return redirectToLogin(origin, "ログインに失敗しました。");
  }

  if (claims.nonce !== oauthState.nonce) {
    return redirectToLogin(origin, "ログインをやり直してください。");
  }

  // クレーム欠落も未検証扱い（fail-closed）。email でのアカウントリンクがあるため。
  if (!isEmailVerified(claims)) {
    return redirectToLogin(origin, "メールアドレスが確認されていません。");
  }

  const result = await establishSession({
    kind: "google",
    googleSub: claims.sub,
    email: claims.email,
    name: claims.name,
  });

  if (!result.ok) {
    return redirectToLogin(origin, result.error);
  }

  // ログイン開始時に保存した戻り先（招待URL 等）へ戻す。安全化済みだが二重で通す。
  const next = sanitizeNextPath(oauthState.next);
  return NextResponse.redirect(new URL(next, origin));
}

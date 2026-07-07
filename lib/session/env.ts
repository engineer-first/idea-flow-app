// セッション・認証まわりの環境変数アクセス。
// SESSION_SECRET の妥当性判定は lib/session/secret.ts に一点集約されている。
import { sessionSecretIssue } from "@/lib/session/secret";

export function isAuthConfigured(): boolean {
  return sessionSecretIssue(process.env.SESSION_SECRET) === null;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const issue = sessionSecretIssue(secret);
  if (issue === "missing-or-short" || secret === undefined) {
    throw new Error(
      "SESSION_SECRET が未設定または短すぎます。32バイト以上の秘密を設定してください。",
    );
  }
  if (issue === "known-insecure") {
    throw new Error(
      "SESSION_SECRET が git 履歴に漏れた既知の値です。新しい秘密を生成してください。",
    );
  }
  return secret;
}

export function isDevAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true"
  );
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error("GOOGLE_CLIENT_ID is required.");
  }
  return id;
}

export function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error("GOOGLE_CLIENT_SECRET is required.");
  }
  return secret;
}

export function getBaseUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (siteUrl) {
    return siteUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
  }

  return "http://localhost:3000";
}

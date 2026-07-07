// セッション・認証まわりの環境変数アクセス。
// git 履歴に漏れた既知の値。本番で誤って再利用されないよう拒否する。
// workers/lib/session-secret.ts の KNOWN_INSECURE_SECRETS と一致させる。
const KNOWN_INSECURE_SECRETS = ["dev-session-secret-change-in-production!!"];
const MIN_SECRET_LENGTH = 16;

export function isAuthConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return Boolean(
    secret &&
      secret.length >= MIN_SECRET_LENGTH &&
      !KNOWN_INSECURE_SECRETS.includes(secret),
  );
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "SESSION_SECRET が未設定または短すぎます。十分な長さの秘密を設定してください。",
    );
  }
  if (KNOWN_INSECURE_SECRETS.includes(secret)) {
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

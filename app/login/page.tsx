import { redirect } from "next/navigation";
import { signInWithDevPassword, signInWithGoogle } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/session/current-user";
import {
  isAuthConfigured,
  isDevAuthEnabled,
  isGoogleAuthConfigured,
} from "@/lib/session/env";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const showDevAuth = isDevAuthEnabled();
  const showGoogleAuth = isGoogleAuthConfigured();

  return (
    <main>
      <h1>IdeaFlow</h1>
      <p>ログインしてください。</p>

      {params.error ? <p role="alert">{params.error}</p> : null}

      {!isAuthConfigured() ? (
        <p>
          認証の環境変数が未設定です。<code>.env.example</code>
          を参考に<code>.env.local</code>を作成してください。
        </p>
      ) : null}

      {showGoogleAuth ? (
        <form action={signInWithGoogle}>
          <button type="submit">Googleでログイン</button>
        </form>
      ) : (
        <p>
          Googleログインは未設定です（<code>GOOGLE_CLIENT_ID</code> /{" "}
          <code>GOOGLE_CLIENT_SECRET</code>）。
        </p>
      )}

      {showDevAuth ? (
        <>
          <hr />
          <h2>開発用ログイン</h2>
          <form action={signInWithDevPassword}>
            <label htmlFor="email">
              メール
              <input
                id="email"
                name="email"
                type="email"
                defaultValue="owner@example.test"
                required
              />
            </label>
            <label htmlFor="password">
              パスワード
              <input
                id="password"
                name="password"
                type="password"
                defaultValue="password"
                required
              />
            </label>
            <button type="submit">開発用ユーザーでログイン</button>
          </form>
        </>
      ) : null}
    </main>
  );
}

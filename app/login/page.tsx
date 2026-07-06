import { redirect } from "next/navigation";
import { signInWithGoogle, signInWithPassword } from "@/app/auth/actions";
import { sanitizeNextPath } from "@/app/auth/redirects";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isDevAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = sanitizeNextPath(params.next ?? null);

  const user = await getCurrentUser();

  if (user) {
    redirect(next);
  }

  const showDevAuth = isDevAuthEnabled();

  return (
    <main>
      <h1>IdeaFlow</h1>
      <p>ログインしてください。</p>

      {params.error ? <p>{params.error}</p> : null}

      {!isSupabaseConfigured() ? (
        <p>
          Supabaseの環境変数が未設定です。<code>.env.example</code>
          を参考に<code>.env.local</code>を作成してください。
        </p>
      ) : null}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit">Googleでログイン</button>
      </form>

      {showDevAuth ? (
        <>
          <hr />
          <h2>開発用ログイン</h2>
          <form action={signInWithPassword}>
            <input type="hidden" name="next" value={next} />
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

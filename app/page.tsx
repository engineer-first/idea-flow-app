import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <main>
        <h1>IdeaFlow</h1>
        <p>Supabaseの環境変数を設定してください。</p>
        <p>
          <code>.env.example</code>を参考に<code>.env.local</code>を作成します。
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>IdeaFlow</h1>
      <p>ログイン済みです。</p>
      <p>{user.email}</p>
      <form action={signOut}>
        <button type="submit">ログアウト</button>
      </form>
    </main>
  );
}

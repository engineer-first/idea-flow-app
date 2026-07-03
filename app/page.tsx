import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>IdeaFlow</h1>
      <p>ログイン済みです。</p>
      <p>{user.email}</p>
      <form action={signOut}>
        <Button type="submit" variant="destructive">
          ログアウト
        </Button>
      </form>
    </main>
  );
}

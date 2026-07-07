import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { SUPABASE_CONFIGURATION_ERROR_MESSAGE } from "@/app/auth/redirects";
import { createRoom } from "@/app/rooms/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <main>
        <h1>IdeaFlow</h1>
        <p>{SUPABASE_CONFIGURATION_ERROR_MESSAGE}</p>
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-normal">IdeaFlow</h1>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>ログイン済みです。</p>
          <p>{user.email}</p>
        </div>
      </header>

      <section className="space-y-4 rounded-lg border p-5">
        <div className="space-y-1">
          <h2 className="text-xl font-medium">ブレストを始める</h2>
          <p className="text-sm text-muted-foreground">
            ルームを作成すると、24時間有効な招待URLを発行します。
          </p>
        </div>
        <form action={createRoom}>
          <Button type="submit">ルームを作成</Button>
        </form>
      </section>

      <form action={signOut}>
        <Button type="submit" variant="destructive">
          ログアウト
        </Button>
      </form>
    </main>
  );
}

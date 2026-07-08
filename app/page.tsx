import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createRoom } from "@/app/rooms/actions";
import { JoinRoomForm } from "@/app/rooms/join-room-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session/current-user";
import { isAuthConfigured } from "@/lib/session/env";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  if (!isAuthConfigured()) {
    return (
      <main>
        <h1>IdeaFlow</h1>
        <p>認証の環境変数を設定してください。</p>
        <p>
          <code>.env.example</code>を参考に<code>.env.local</code>を作成します。
        </p>
      </main>
    );
  }

  const params = await searchParams;
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

      {params.error ? <p role="alert">{params.error}</p> : null}

      <hr />

      <section>
        <h2>ルームを作成</h2>
        <form action={createRoom}>
          <Button type="submit">ルームを作成</Button>
        </form>
      </section>

      <section>
        <h2>招待コードで参加</h2>
        <JoinRoomForm />
      </section>
    </main>
  );
}

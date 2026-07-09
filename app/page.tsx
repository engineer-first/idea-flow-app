import { redirect } from "next/navigation";
import { HomeView } from "@/app/home-view";
import { createRoom } from "@/app/rooms/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session/current-user";
import { isAuthConfigured } from "@/lib/session/env";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  if (!isAuthConfigured()) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="flex h-full flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">認証の設定が必要です</CardTitle>
              <CardDescription>
                認証の環境変数を設定してください。
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                <code className="font-mono text-xs">.env.example</code>
                を参考に
                <code className="font-mono text-xs">.env.local</code>
                を作成します。
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col">
      <HomeView error={params.error} createRoomAction={createRoom} />
    </main>
  );
}

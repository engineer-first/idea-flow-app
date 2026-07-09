// ホーム画面（ルーム作成・参加）のプレゼンテーション層。
// Server Action や認証は page.tsx の責務。ここでは Card UI と操作の橋渡しだけ。
// レイアウトは StartRoomView（shadcn Card 中央寄せ）に揃える。
import { JoinRoomForm } from "@/app/rooms/join-room-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type HomeViewProps = {
  userEmail: string;
  error?: string;
  createRoomAction: (formData: FormData) => void | Promise<void>;
  signOutAction: (formData: FormData) => void | Promise<void>;
};

export function HomeView({
  userEmail,
  error,
  createRoomAction,
  signOutAction,
}: HomeViewProps) {
  return (
    <div
      className="flex h-full flex-1 flex-col"
      data-testid="home-view"
    >
      <header
        className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"
        data-testid="home-view-header"
      >
        <p
          className="truncate text-sm text-muted-foreground"
          data-testid="home-view-user-email"
        >
          {userEmail}
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            ログアウト
          </Button>
        </form>
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">IdeaFlow</CardTitle>
            <CardDescription>
              ルームを作成するか、招待コードで参加
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <section
              className="flex flex-col gap-3"
              data-testid="home-create-room"
            >
              <h2 className="text-sm font-medium">ルームを作成</h2>
              <form action={createRoomAction}>
                <Button type="submit" size="lg" className="w-full">
                  ルームを作成
                </Button>
              </form>
            </section>

            <div className="border-t border-border" />

            <section
              className="flex flex-col gap-3"
              data-testid="home-join-room"
            >
              <h2 className="text-sm font-medium">ルームに参加</h2>
              <JoinRoomForm />
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

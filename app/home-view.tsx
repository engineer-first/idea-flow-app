// ホーム画面（ルーム作成・参加）のプレゼンテーション層。
// Server Action や認証は page.tsx の責務。ここでは Card UI と操作の橋渡しだけ。
// アプリ名 IdeaFlow は root layout の AppHeader のみが担う（ここでは出さない）。
// レイアウトは StartRoomView（shadcn Card 中央寄せ）に揃える。
import { JoinRoomForm } from "@/app/rooms/join-room-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type HomeViewProps = {
  error?: string;
  createRoomAction: (formData: FormData) => void | Promise<void>;
};

export function HomeView({ error, createRoomAction }: HomeViewProps) {
  return (
    <div
      className="flex h-full flex-1 items-center justify-center p-4"
      data-testid="home-view"
    >
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-6 p-6">
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

          <section className="flex flex-col gap-3" data-testid="home-join-room">
            <h2 className="text-sm font-medium">ルームに参加</h2>
            <JoinRoomForm />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

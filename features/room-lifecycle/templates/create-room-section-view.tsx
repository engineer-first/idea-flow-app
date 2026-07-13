// ホーム「ルームを作成」の表示専用（NoteCard と同様、見た目は props で固定）。
// 副作用（Server Action / 遷移）は CreateRoomSection コンテナ側。
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type CreateRoomSectionViewProps = {
  // true の間は「作成中…」表示とボタン disabled。
  pending?: boolean;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CreateRoomSectionView({
  pending = false,
  onSubmit,
}: CreateRoomSectionViewProps) {
  return (
    <Card
      className="flex h-full flex-col border-border/80 shadow-sm transition-shadow hover:shadow-md"
      data-testid="home-create-room"
    >
      <CardHeader className="gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Plus className="size-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <CardTitle className="text-base">ルームを作成</CardTitle>
          <CardDescription className="leading-relaxed">
            ホストとして新しいセッションを開き、メンバーを招待します。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter>
        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.(event);
          }}
        >
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending}
            data-icon="inline-start"
          >
            <Plus data-icon="inline-start" aria-hidden />
            {pending ? "作成中…" : "ルームを作成"}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

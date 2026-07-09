// ホーム「ルームを作成」の表示専用（NoteCard と同様、見た目は props で固定）。
// 副作用（Server Action / 遷移）は CreateRoomSection コンテナ側。
import { Button } from "@/components/ui/button";

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
    <section className="flex flex-col gap-3" data-testid="home-create-room">
      <h2 className="text-sm font-medium">ルームを作成</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
      >
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "作成中…" : "ルームを作成"}
        </Button>
      </form>
    </section>
  );
}

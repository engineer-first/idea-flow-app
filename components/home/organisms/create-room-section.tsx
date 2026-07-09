// ホーム「ルームを作成」セクション（organism）。
import { Button } from "@/components/ui/button";

export type CreateRoomSectionProps = {
  createRoomAction: (formData: FormData) => void | Promise<void>;
};

export function CreateRoomSection({
  createRoomAction,
}: CreateRoomSectionProps) {
  return (
    <section className="flex flex-col gap-3" data-testid="home-create-room">
      <h2 className="text-sm font-medium">ルームを作成</h2>
      <form action={createRoomAction}>
        <Button type="submit" size="lg" className="w-full">
          ルームを作成
        </Button>
      </form>
    </section>
  );
}

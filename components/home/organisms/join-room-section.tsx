// ホーム「ルームに参加」セクション（organism / コンテナ）。
// 招待コード入力 + 確認 Dialog は JoinRoomForm（rooms ドメイン）に委譲する。
import { JoinRoomForm } from "@/app/rooms/join-room-form";

export function JoinRoomSection() {
  return (
    <section className="flex flex-col gap-3" data-testid="home-join-room">
      <h2 className="text-sm font-medium">ルームに参加</h2>
      <JoinRoomForm />
    </section>
  );
}

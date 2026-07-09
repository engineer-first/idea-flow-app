// ホーム「ルームに参加」セクションの表示専用。
// 見出し + JoinRoomFormView を合成する（Storybook で状態固定しやすい）。
import {
  JoinRoomFormView,
  type JoinRoomFormViewProps,
} from "@/app/rooms/join-room-form-view";

export type JoinRoomSectionViewProps = JoinRoomFormViewProps;

export function JoinRoomSectionView(props: JoinRoomSectionViewProps) {
  return (
    <section className="flex flex-col gap-3" data-testid="home-join-room">
      <h2 className="text-sm font-medium">ルームに参加</h2>
      <JoinRoomFormView {...props} />
    </section>
  );
}

// ルーム内メンバー一覧の表示用コンポーネント。アバターを横並びにし、
// 自分には「あなた」マーカー、多人数なら +N バッジで省略する。
// データ層に一切依存せず、members と currentUserId を props で受け取るだけ。
import { Avatar } from "@/app/rooms/[id]/avatar";
import type { Member } from "@/app/rooms/room-reducer";

export type RoomMembersProps = {
  members: Member[];
  currentUserId: string;
  // 先頭から何個までアバターで描画するか。超過分は +N バッジ。
  // 既定は 5（ホスト + 4 名程度が見える）。
  maxVisible?: number;
};

export function RoomMembers({
  members,
  currentUserId,
  maxVisible = 5,
}: RoomMembersProps) {
  const visible = members.slice(0, maxVisible);
  const hidden = members.length - visible.length;

  return (
    <fieldset
      aria-label="参加者"
      data-testid="room-members"
      className="flex items-center -space-x-2 border-0 p-0 m-0"
    >
      {visible.map((member) => (
        <Avatar
          key={member.userId}
          name={member.name}
          isMe={member.userId === currentUserId}
        />
      ))}
      {hidden > 0 ? (
        <div
          role="img"
          aria-label={`他 ${hidden} 名`}
          data-testid="room-members-overflow"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-muted-foreground"
        >
          +{hidden}
        </div>
      ) : null}
    </fieldset>
  );
}

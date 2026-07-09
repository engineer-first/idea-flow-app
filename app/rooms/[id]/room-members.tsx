// ルーム内メンバー一覧の表示用コンポーネント。
// Avatar + 名前を横並びで表示し、自分には「（あなた）」マーカー、
// 多人数なら +N バッジで省略する。データ層に一切依存せず、
// members と currentUserId を props で受け取るだけ。
import { Avatar } from "@/app/rooms/[id]/avatar";
import type { Member } from "@/app/rooms/room-reducer";
import { cn } from "@/lib/utils";

export type RoomMembersProps = {
  members: Member[];
  currentUserId: string;
  // 先頭から何個まで Avatar + 名前で描画するか。超過分は +N バッジ。
  // 既定は 5。ボード画面の上部バーなどスペースが限られる場面では 3 程度を
  // 利用側に指定することを想定。
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
      className="flex flex-wrap items-center gap-3 border-0 p-0 m-0"
    >
      {visible.map((member) => {
        const isMe = member.userId === currentUserId;
        return (
          <div
            key={member.userId}
            data-testid={`member-row-${member.userId}`}
            data-self={isMe ? "true" : undefined}
            className="flex items-center gap-1.5"
          >
            <Avatar name={member.name} isMe={isMe} />
            <span
              className={cn(
                "max-w-[8rem] truncate text-xs",
                isMe ? "font-semibold text-foreground" : "text-foreground/80",
              )}
            >
              {member.name}
              {isMe ? (
                <span className="ml-1 text-muted-foreground">（あなた）</span>
              ) : null}
            </span>
          </div>
        );
      })}
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

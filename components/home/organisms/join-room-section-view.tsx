// ホーム「ルームに参加」セクションの表示専用。
// 見出し + JoinRoomFormView を shadcn Card で包む。
import { LogIn } from "lucide-react";
import {
  JoinRoomFormView,
  type JoinRoomFormViewProps,
} from "@/app/rooms/join-room-form-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type JoinRoomSectionViewProps = JoinRoomFormViewProps;

export function JoinRoomSectionView(props: JoinRoomSectionViewProps) {
  return (
    <Card
      className="flex h-full flex-col border-border/80 shadow-sm transition-shadow hover:shadow-md"
      data-testid="home-join-room"
    >
      <CardHeader className="gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <LogIn className="size-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <CardTitle className="text-base">ルームに参加</CardTitle>
          <CardDescription className="leading-relaxed">
            ホストから共有された 6 桁の招待コードを入力します。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <JoinRoomFormView {...props} />
      </CardContent>
    </Card>
  );
}

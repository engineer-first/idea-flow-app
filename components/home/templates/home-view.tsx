// ホーム画面の template（アトミックデザイン: pages 層は使わない）。
// Server Action や認証は app/home/page.tsx の責務。
// アプリ名 IdeaFlow は root layout の AppHeader のみが担う。
import { HomeErrorAlert } from "@/components/home/molecules/home-error-alert";
import { CreateRoomSection } from "@/components/home/organisms/create-room-section";
import { JoinRoomSection } from "@/components/home/organisms/join-room-section";
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
          {error ? <HomeErrorAlert message={error} /> : null}
          <CreateRoomSection createRoomAction={createRoomAction} />
          <div className="border-t border-border" />
          <JoinRoomSection />
        </CardContent>
      </Card>
    </div>
  );
}

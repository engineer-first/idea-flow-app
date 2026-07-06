import { CopyInviteButton } from "@/app/rooms/[inviteCode]/copy-invite-button";

type RoomDetailProps = {
  inviteUrl: string;
  inviteExpiresAt: string;
  memberRole: "host" | "participant";
  userEmail: string | null | undefined;
};

export function RoomDetail({
  inviteUrl,
  inviteExpiresAt,
  memberRole,
  userEmail,
}: RoomDetailProps) {
  const expiresAt = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(inviteExpiresAt));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">IdeaFlow</p>
        <h1 className="text-3xl font-semibold tracking-normal">
          ブレストルーム
        </h1>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>{userEmail}</span>
          <span>{memberRole}</span>
        </div>
      </header>

      <section className="space-y-4 rounded-lg border p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">招待URL</h2>
          <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
            {inviteUrl}
          </p>
          <p className="text-sm text-muted-foreground">
            有効期限: <time dateTime={inviteExpiresAt}>{expiresAt}</time>
          </p>
        </div>
        <CopyInviteButton inviteUrl={inviteUrl} />
      </section>
    </main>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ExpiredInvitePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-6 py-10">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">IdeaFlow</p>
        <h1 className="text-2xl font-semibold">招待URLを利用できません</h1>
        <p className="text-muted-foreground">
          この招待URLは無効または期限切れです。ホストに新しい招待URLを共有してもらってください。
        </p>
      </div>
      <Button asChild>
        <Link href="/">homeへ戻る</Link>
      </Button>
    </main>
  );
}

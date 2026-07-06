"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type CopyInviteButtonProps = {
  inviteUrl: string;
};

export function CopyInviteButton({ inviteUrl }: CopyInviteButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyInviteUrl() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={copyInviteUrl}>
        招待URLをコピー
      </Button>
      {status === "copied" ? (
        <p className="text-sm text-muted-foreground">コピーしました</p>
      ) : null}
      {status === "failed" ? (
        <p className="text-sm text-destructive">コピーできませんでした</p>
      ) : null}
    </div>
  );
}

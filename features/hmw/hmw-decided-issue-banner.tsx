// フェーズ1から持ち越された決定課題をボード上に掲示するフローティングバナー。
// Step 2-2 以降テンプレートパネルが消えても掲示だけは残るため、
// パネルから独立した1要素にしている。
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { DECIDED_ISSUE_LABEL } from "./hmw-content";

export type HmwDecidedIssueBannerProps = {
  // フェーズ1から持ち越された決定課題の本文
  content: string;
  className?: string;
};

export function HmwDecidedIssueBanner({
  content,
  className,
}: HmwDecidedIssueBannerProps) {
  return (
    <div
      data-testid="hmw-decided-issue-banner"
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 shadow-md",
        className,
      )}
    >
      <Pin
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="shrink-0 font-medium text-muted-foreground text-sm">
        {DECIDED_ISSUE_LABEL}
      </span>
      {/* 1行バナーに収めるため truncate し、全文は title 属性で読めるようにする */}
      <span title={content} className="min-w-0 truncate font-semibold text-sm">
        {content}
      </span>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type CopyInviteButtonProps = {
  // 表示・クリップボードへ書き込む文字列（招待URL / 招待コード）。
  value: string;
  // aria-label 用の対象名。既定は「招待URL」。
  itemLabel?: string;
  className?: string;
};

// 招待URL・招待コード自体を表示し、クリックでクリップボードへコピーする。
// 成功したときだけ一時的に「コピーしました」に切り替える
// （失敗時に成功表示を出すと、貼り付けたら空だった、という事故になる）。
export function CopyInviteButton({
  value,
  itemLabel = "招待URL",
  className,
}: CopyInviteButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error(`${itemLabel}のコピーに失敗しました:`, error);
    }
  }, [value, itemLabel]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "コピーしました" : `${itemLabel}をコピー`}
      title={copied ? "コピーしました" : `クリックで${itemLabel}をコピー`}
      className={cn(
        "max-w-full cursor-pointer truncate text-center font-mono text-sm font-semibold tracking-wider text-foreground underline-offset-2 hover:underline",
        className,
      )}
    >
      {copied ? "コピーしました" : value}
    </button>
  );
}

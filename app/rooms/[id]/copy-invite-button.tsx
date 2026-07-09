"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type CopyInviteButtonProps = {
  // クリップボードへ書き込む文字列（招待URL / 招待コードなど）。
  value: string;
  // aria-label 用の対象名。既定は「招待URL」。
  itemLabel?: string;
};

// 招待URL・招待コードをワンクリックでクリップボードへコピーする。
// 成功したときだけ一時的に「コピーしました」に切り替える
// （失敗時に成功表示を出すと、貼り付けたら空だった、という事故になる）。
export function CopyInviteButton({
  value,
  itemLabel = "招待URL",
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label={copied ? "コピーしました" : `${itemLabel}をコピー`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          コピーしました
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden="true" />
          コピー
        </>
      )}
    </Button>
  );
}

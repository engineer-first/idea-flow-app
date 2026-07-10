// 参加メンバーのアバター（イニシャル + ハッシュ由来カラー）。
// 画像取得は行わない（このスコープ外）。背景色は name のハッシュで決定論的に
// 選ばれる Tailwind クラスで、Tailwind の JIT が確実に拾うよう文字列リテラル
// として書く。
//
// サイズは prop で変更できるが、RoomMembers 側では 36px 固定で使う前提。
// 「あなた」マーカーは isMe で枠線（ring）として表現する。
// ホバー時の名前表示は Radix Tooltip で行う。
// TooltipProvider は一覧側（RoomMembers）に 1 つ置き、ここでは Tooltip のみ。
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const AVATAR_COLOR_CLASSES = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
] as const;

export type AvatarColorClass = (typeof AVATAR_COLOR_CLASSES)[number];

// 名前から背景色クラスを選ぶ。name が空でも 0 番目（blue）を返す。
// ハッシュは 32-bit の巡回（>>> 0）で十分な分布を作る。
export function avatarColorClass(name: string): AvatarColorClass {
  if (!name) return AVATAR_COLOR_CLASSES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLOR_CLASSES[hash % AVATAR_COLOR_CLASSES.length];
}

// 名前の頭文字 2 文字を返す。仕様:
// - 空白で分割し、先頭 2 トークンの先頭 1 文字ずつ
// - 1 トークンだけの場合は文字列の先頭 2 文字（英語 / 日本語の両方に対応）
// - 空文字 / 空白のみは ??
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0]?.charAt(0) ?? "";
    const second = parts[1]?.charAt(0) ?? "";
    return ((first || "?") + (second || "?")).toUpperCase();
  }
  return (trimmed.slice(0, 2) || "??").toUpperCase();
}

export type AvatarProps = {
  name: string;
  // 直径 (px)。既定は 36。
  size?: number;
  // 自分自身かどうか。true で青いリング（"あなた" マーカー）。
  isMe?: boolean;
};

export function Avatar({ name, size = 36, isMe = false }: AvatarProps) {
  const initials = initialsOf(name);
  const colorClass = avatarColorClass(name);
  // 自分は ring（枠）で識別する。文言の「（あなた）」は付けない。
  const tooltipText = name || "不明なメンバー";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="img"
          aria-label={tooltipText}
          data-testid="avatar"
          data-self={isMe ? "true" : undefined}
          className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorClass} ${
            isMe
              ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
              : ""
          }`}
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.4),
          }}
        >
          {initials}
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

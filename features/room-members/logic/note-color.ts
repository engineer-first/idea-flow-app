import type { NoteColor } from "@/contracts/room-protocol";

// FigJam の淡い付箋を基調にした20色。付箋とアバターには同じ背景色を直接適用する。
// 白・薄灰色のアバターだけは、背景との境界を保つために枠線を付ける。
export const NOTE_COLOR_STYLES: Record<
  NoteColor,
  { backgroundColor: string; avatarClassName: string }
> = {
  yellow: { backgroundColor: "#FFE299", avatarClassName: "" },
  green: { backgroundColor: "#B3EFBD", avatarClassName: "" },
  blue: { backgroundColor: "#A8DAFF", avatarClassName: "" },
  pink: { backgroundColor: "#FFA8DB", avatarClassName: "" },
  orange: { backgroundColor: "#FFD3A8", avatarClassName: "" },
  purple: { backgroundColor: "#D3BDFF", avatarClassName: "" },
  red: { backgroundColor: "#FFB8A8", avatarClassName: "" },
  lime: { backgroundColor: "#CDF4D3", avatarClassName: "" },
  teal: { backgroundColor: "#B3F4EF", avatarClassName: "" },
  cyan: { backgroundColor: "#C6FAF6", avatarClassName: "" },
  indigo: { backgroundColor: "#C2E5FF", avatarClassName: "" },
  violet: { backgroundColor: "#E4CCFF", avatarClassName: "" },
  fuchsia: { backgroundColor: "#FFC2EC", avatarClassName: "" },
  rose: { backgroundColor: "#FFCDC2", avatarClassName: "" },
  amber: { backgroundColor: "#FFE0C2", avatarClassName: "" },
  emerald: { backgroundColor: "#FFECBD", avatarClassName: "" },
  sky: { backgroundColor: "#D9D9D9", avatarClassName: "border-slate-300" },
  slate: { backgroundColor: "#E6E6E6", avatarClassName: "border-slate-300" },
  stone: { backgroundColor: "#F5EDE2", avatarClassName: "" },
  zinc: { backgroundColor: "#FFFFFF", avatarClassName: "border-slate-300" },
};

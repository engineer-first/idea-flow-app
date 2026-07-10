// RoomMembers の spec / stories で共有するテストデータ。
// 実際の name は英語のファースト/ラスト形式（Google ログインの表示名を想定）。
import type { Member } from "@/app/rooms/room-reducer";
import type { NoteColor } from "@/contracts/room-protocol";

const COLORS: NoteColor[] = [
  "yellow",
  "green",
  "blue",
  "pink",
  "orange",
  "purple",
];

const NAMES = [
  "Yuki Tanaka",
  "Taro Yamada",
  "Hanako Sato",
  "Jiro Suzuki",
  "Saburo Kato",
  "Shiro Watanabe",
  "Goro Ito",
  "Hiroko Aoki",
];

export function buildMembers(count: number, currentUserId?: string): Member[] {
  return Array.from({ length: count }, (_, index) => {
    // 1 番目（index=0）を currentUserId にすると「自分判定」のテストが楽。
    // currentUserId を指定しない場合は機械的に振る。
    const userId =
      currentUserId && index === 0
        ? currentUserId
        : makeUuid(index, currentUserId);
    return {
      userId,
      name: NAMES[index] ?? `Member ${index + 1}`,
      color: COLORS[index % COLORS.length],
    };
  });
}

// currentUserId 以外の ID を生成する（currentUserId が先頭に置かれるので
// index=1 以降が衝突しないようにする）。
function makeUuid(index: number, currentUserId?: string): string {
  if (index === 0 && currentUserId) return currentUserId;
  // 固定の UUID っぽい文字列を返す（テスト間の安定性のため）。
  return `${index.toString().padStart(8, "0")}0000-4000-8000-0000-000000000000`;
}

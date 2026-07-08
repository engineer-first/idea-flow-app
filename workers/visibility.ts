// 可視性ルールの一点集約。
// スナップショットの絞り込みも配信の宛先判定も、必ずこの関数を通る
// （push 型の可視性制御は「送らないコード」の正しさが全てなので、
// 判定ロジックの分散を構造的に禁止する）。
//
// 現時点の仕様: ルームメンバーは全付箋を見られる（PoC と同じ共有ボード）。
// 個人ワーク（自分の付箋のみ見える）やステルス投票のフェーズを導入するときは、
// ここにフェーズ・ロールに応じた分岐を追加し、visibility.spec.ts の
// テーブルに必ず対応する行を足すこと。
import type { ProtocolNote } from "../contracts/room-protocol";

export type VisibilityContext = {
  viewerId: string;
};

export function visibleTo(
  context: VisibilityContext,
  note: ProtocolNote,
): boolean {
  // 共有ボードフェーズ: メンバー全員がすべての付箋を見られる。
  // viewerId と note は将来の分岐（author 限定表示など）で使う。
  void context;
  void note;
  return true;
}

export function filterVisible(
  context: VisibilityContext,
  notes: ProtocolNote[],
): ProtocolNote[] {
  return notes.filter((note) => visibleTo(context, note));
}

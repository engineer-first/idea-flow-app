// 可視性ルールの一点集約。
// スナップショットの絞り込みも配信の宛先判定も、必ずこの関数を通る
// （push 型の可視性制御は「送らないコード」の正しさが全てなので、
// 判定ロジックの分散を構造的に禁止する）。
//
// private の付箋は作者だけ、shared の付箋はルームメンバー全員に配信する。
import type { ProtocolNote } from "../contracts/room-protocol";

export type VisibilityContext = {
  viewerId: string;
};

export function visibleTo(
  context: VisibilityContext,
  note: ProtocolNote,
): boolean {
  return note.visibility === "shared" || note.authorId === context.viewerId;
}

export function filterVisible(
  context: VisibilityContext,
  notes: ProtocolNote[],
): ProtocolNote[] {
  return notes.filter((note) => visibleTo(context, note));
}

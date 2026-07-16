// 進行状態（lobby / 課題整理のステップ）の真実と、進行操作・境界ゲート。
import {
  getRoomPhaseLabel,
  isLobby,
  isVotingStep,
  type PHASE_STEP_COUNTS,
  type RoomPhase,
  RoomPhaseSchema,
} from "../../contracts/phase";
import type { ClientMessage } from "../../contracts/room-protocol";
import type { MessageHandlers } from "./handler-context";
import { isHostUser } from "./members";
import { haveAllMembersCompletedVoting } from "./votes";

export function getPhase(sql: SqlStorage): RoomPhase {
  const rows = sql.exec("SELECT phase FROM room_state WHERE id = 1").toArray();
  const row = rows[0] as { phase: string } | undefined;
  return decodePhase(row?.phase ?? "lobby");
}

export function savePhase(sql: SqlStorage, phase: RoomPhase): void {
  sql.exec("UPDATE room_state SET phase = ?1 WHERE id = 1", encodePhase(phase));
}

function encodePhase(phase: RoomPhase): string {
  if (isLobby(phase)) return "lobby";
  return `phase${phase.phase}-step${phase.step}`;
}

// 保存形式は encodePhase が書く「lobby / phaseN-stepM」だけ。旧フラット形式
// （writing / phase1..4）は migration normalize-legacy-phase-values が保存時に
// 正規化済み。未知の値は lobby へ fail-safe する（進行を勝手に進めない側に倒す）。
function decodePhase(value: string): RoomPhase {
  if (value === "lobby") return { kind: "lobby" };
  const match = /^phase(\d+)-step(\d+)$/.exec(value);
  if (!match) return { kind: "lobby" };
  const parsed = RoomPhaseSchema.safeParse({
    kind: "step",
    phase: Number(match[1]),
    step: Number(match[2]),
  });
  return parsed.success ? parsed.data : { kind: "lobby" };
}

function nextRoomPhase(current: RoomPhase): RoomPhase {
  if (isLobby(current)) return { kind: "step", phase: 1, step: 1 };
  if (current.phase === 1 && current.step < 5) {
    return { ...current, step: current.step + 1 };
  }
  // Step 1-5 の次はフェーズ2だが、その実装はこの Issue のスコープ外。
  return current;
}

// WebSocket を直接送られても状態が変わらないよう、変更系メッセージを
// room-do.ts の handleClientMessage 前段で一元的に判定する。
export function isBoardMutation(message: ClientMessage): boolean {
  switch (message.type) {
    case "note:create":
    case "note:publish":
    case "note:unpublish":
    case "note:update-content":
    case "note:move":
    case "note:drag":
    case "note:delete":
    case "note:vote":
    case "note:vote-reset":
    case "note:decide":
    case "group:create":
    case "group:update-name":
      return true;
    case "start_phase":
    case "phase:next":
    case "timer:start":
    case "timer:pause":
    case "timer:resume":
    case "timer:extend":
    case "timer:stop":
      return false;
  }
}

const allowedBoardMutationsByPhase: {
  [Phase in keyof typeof PHASE_STEP_COUNTS]: Record<
    number,
    readonly ClientMessage["type"][]
  >;
} = {
  1: {
    1: ["note:create", "note:update-content", "note:delete"],
    2: [
      "note:publish",
      "note:unpublish",
      "note:update-content",
      "note:move",
      "note:drag",
    ],
    3: ["note:move", "note:drag", "group:create", "group:update-name"],
    4: ["note:vote", "note:vote-reset"],
    5: ["note:decide"],
  },
  2: {
    1: [],
    2: [],
    3: [],
    4: [],
  },
  3: {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  },
};

// 変更系メッセージをハンドラより前に判定する。null は許可、文字列は拒否理由。
// author / 可視性の認可は、このゲート通過後に各ハンドラで検証する。
export function getBoardMutationForbiddenMessage(
  phase: RoomPhase,
  message: ClientMessage,
): string | null {
  if (!isBoardMutation(message)) return null;
  if (isLobby(phase)) return "ボード開始前はボードを変更できません。";
  const allowed = allowedBoardMutationsByPhase[phase.phase]?.[phase.step] ?? [];
  if (allowed.includes(message.type)) return null;
  return `${getRoomPhaseLabel(phase)}ではこの操作を行えません。`;
}

// フェーズ進行の認可は room_owner（isHostUser）に一本化している。
// D1 由来の hostId ヘッダーを認可ソースに加えない（旧ルームのバックフィル
// シードにすぎない。room-do.ts の HOST_ID_HEADER 参照）。
export const phaseHandlers: MessageHandlers<"start_phase" | "phase:next"> = {
  // ロビー → Step 1-1（ボード開始）。ホストのみ。
  start_phase: (ctx) => {
    if (!isHostUser(ctx.sql, ctx.userId)) {
      ctx.reply({
        type: "error",
        code: "forbidden",
        message: "進行状態を変更する権限がありません。",
      });
      return;
    }
    if (!isLobby(getPhase(ctx.sql))) {
      ctx.reply({
        type: "error",
        code: "forbidden",
        message: "すでに開始済みです。",
      });
      return;
    }
    const firstStep: RoomPhase = { kind: "step", phase: 1, step: 1 };
    savePhase(ctx.sql, firstStep);
    ctx.broadcaster.broadcastToAll({
      type: "phase:updated",
      phase: firstStep,
    });
  },

  // Step 1-1 → Step 1-5。ホストのみ。lobby では不可。
  "phase:next": (ctx, message) => {
    if (!isHostUser(ctx.sql, ctx.userId)) {
      ctx.reply({
        type: "error",
        code: "forbidden",
        message: "ホストのみ操作できます。",
      });
      return;
    }
    const current = getPhase(ctx.sql);
    if (isLobby(current)) {
      ctx.reply({
        type: "error",
        code: "forbidden",
        message: "ロビー中は次フェーズに進めません。",
      });
      return;
    }
    // force はホストだけが使える脱出ハッチ（上のホストチェックが先に
    // 効く）。離脱して戻らないメンバーが居ても進行を止めないための経路。
    if (
      isVotingStep(current) &&
      !message.force &&
      !haveAllMembersCompletedVoting(ctx.sql)
    ) {
      ctx.reply({
        type: "error",
        code: "voting-incomplete",
        message: "全員の主観・客観投票が完了していません。",
      });
      return;
    }
    const next = nextRoomPhase(current);
    // Step 1-5 など「次のフェーズがまだ実装されていない」状態では
    // nextRoomPhase が current をそのまま返す。ここで no-op を配信すると
    // クライアントの decision 表示がフェーズ単位で無条件クリアされてしまう
    // （DB上の decision は残るため、再接続時の snapshot で復活し不整合になる）。
    if (next === current) {
      return;
    }
    savePhase(ctx.sql, next);
    ctx.broadcaster.broadcastToAll({ type: "phase:updated", phase: next });
  },
};

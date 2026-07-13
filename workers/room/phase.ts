// 進行状態 (lobby / phase1-4) の真実と、フェーズ進行の操作。
import type { ClientMessage, Phase } from "../../contracts/room-protocol";
import type { MessageHandlers } from "./handler-context";
import { isHostUser } from "./members";
import { haveAllMembersCompletedVoting } from "./votes";

export function getPhase(sql: SqlStorage): Phase {
  const rows = sql.exec("SELECT phase FROM room_state WHERE id = 1").toArray();
  const row = rows[0] as { phase: string } | undefined;
  const phase = row?.phase ?? "lobby";
  if (
    phase === "lobby" ||
    phase === "phase1" ||
    phase === "phase2" ||
    phase === "phase3" ||
    phase === "phase4"
  ) {
    return phase;
  }
  // 旧 "writing" は phase1 扱い
  if (phase === "writing") return "phase1";
  return "lobby";
}

export function savePhase(sql: SqlStorage, phase: Phase): void {
  sql.exec("UPDATE room_state SET phase = ?1 WHERE id = 1", phase);
}

function nextSprintPhase(current: Phase): Phase {
  switch (current) {
    case "lobby":
      return "phase1";
    case "phase1":
      return "phase2";
    case "phase2":
      return "phase3";
    case "phase3":
      return "phase4";
    case "phase4":
      return "phase4";
  }
}

// lobby はボード開始前、phase4 は投票結果を確認しながら話し合う工程。
// どちらも「ボードを変更してよい工程」ではないため、WebSocket を直接
// 送られても状態が変わらないよう、変更系メッセージを境界で一元的に拒否する
// （判定は room-do.ts の handleClientMessage が全ハンドラの前段で行う）。
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

// フェーズ進行の認可は room_owner（isHostUser）に一本化している。
// D1 由来の hostId ヘッダーを認可ソースに加えない（旧ルームのバックフィル
// シードにすぎない。room-do.ts の HOST_ID_HEADER 参照）。
export const phaseHandlers: MessageHandlers<"start_phase" | "phase:next"> = {
  // ロビー → phase1（ボード開始）。ホストのみ。
  start_phase: (ctx) => {
    if (!isHostUser(ctx.sql, ctx.userId)) {
      ctx.reply({
        type: "error",
        code: "forbidden",
        message: "進行状態を変更する権限がありません。",
      });
      return;
    }
    if (getPhase(ctx.sql) !== "lobby") {
      ctx.reply({
        type: "error",
        code: "forbidden",
        message: "すでに開始済みです。",
      });
      return;
    }
    savePhase(ctx.sql, "phase1");
    ctx.broadcaster.broadcastToAll({ type: "phase:updated", phase: "phase1" });
  },

  // phase1 → phase2 → phase3 → phase4。ホストのみ。lobby では不可。
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
    if (current === "lobby") {
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
      current === "phase3" &&
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
    const next = nextSprintPhase(current);
    savePhase(ctx.sql, next);
    ctx.broadcaster.broadcastToAll({ type: "phase:updated", phase: next });
  },
};

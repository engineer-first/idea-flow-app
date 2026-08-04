import type { RoomPhase } from "@/contracts/phase";

export type BoardPermissions = {
  // 付箋作成入口
  showPrivateToolbar: boolean;

  // 付箋操作
  canCreateNote: boolean;
  canEditNote: boolean;
  canDeleteNote: boolean;
  canMoveNote: boolean;

  // グループ
  canGroupNote: boolean;

  //投票
  canShowVote: boolean;
  canVote: boolean;

  // 結果確定
  canDecide: boolean;
};

const ALL_DISABLED: BoardPermissions = {
  showPrivateToolbar: false,

  canCreateNote: false,
  canEditNote: false,
  canDeleteNote: false,
  canMoveNote: false,

  canGroupNote: false,

  canShowVote: false,
  canVote: false,

  canDecide: false,
};

export function getBoardPermissions(phase: RoomPhase): BoardPermissions {
  if (phase.kind === "lobby") {
    return ALL_DISABLED;
  }

  // 今回の対象はフェーズ1 Step1〜5
  if (phase.phase !== 1) {
    return ALL_DISABLED;
  }

  switch (phase.step) {
    // Step1-1 課題を個人で書く
    case 1:
      return {
        showPrivateToolbar: true,

        canCreateNote: true,
        canEditNote: true,
        canDeleteNote: true,
        canMoveNote: false,

        canGroupNote: false,

        canShowVote: false,
        canVote: false,

        canDecide: false,
      };

    // Step1-2 共有する
    case 2:
      return {
        showPrivateToolbar: true,

        canCreateNote: false,
        canEditNote: true,
        canDeleteNote: false,
        canMoveNote: true,

        canGroupNote: false,

        canShowVote: false,
        canVote: false,

        canDecide: false,
      };

    // Step1-3 グループ化
    case 3:
      return {
        showPrivateToolbar: false,

        canCreateNote: false,
        canEditNote: false,
        canDeleteNote: false,
        canMoveNote: true,

        canGroupNote: true,

        canShowVote: false,
        canVote: false,

        canDecide: false,
      };

    // Step1-4 ステルス投票
    case 4:
      return {
        showPrivateToolbar: false,

        canCreateNote: false,
        canEditNote: false,
        canDeleteNote: false,
        canMoveNote: false,

        canGroupNote: false,

        canShowVote: true,
        canVote: true,

        canDecide: false,
      };

    // Step1-5 集計確認・絞り込み
    case 5:
      return {
        showPrivateToolbar: false,

        canCreateNote: false,
        canEditNote: false,
        canDeleteNote: false,
        canMoveNote: false,

        canGroupNote: false,

        canShowVote: true,
        canVote: false,

        canDecide: true,
      };

    default:
      return ALL_DISABLED;
  }
}

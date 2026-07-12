// 通知ヘルパ。sonner の `toast` を薄いラッパーで re-export して、
// アプリ内の通知文言をここで一元管理する（typo 防止と i18n 移行の足場）。
"use client";

import { toast } from "sonner";

// 通知の種類を文字列で指定する。各キーは表示文言に解決される。
// ルーム内イベントの通知は features/room/room-notify.ts へ移設済み。
// 残りの作成・参加系も room-lifecycle feature の移設時に解体する予定。
export const notify = {
  roomCreated(): void {
    toast.success("ルームを作成しました");
  },
  joinedAsGuest(): void {
    toast.success("ルームに参加しました");
  },
  // エラー系は Server Action 側でリダイレクトや throw されるため、
  // クライアントから呼ばれる場面は限定的。必要になったら追加。
  error(message: string): void {
    toast.error(message);
  },
};

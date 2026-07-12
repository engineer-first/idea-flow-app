// ルーム作成・参加フローの通知文言。sonner の toast を薄くラップし、
// この feature の通知文言をここで一元管理する（typo 防止と i18n 移行の足場）。
// 文言を持たない汎用エラー通知は @/lib/notify を使う。
"use client";

import { toast } from "sonner";

export const lifecycleNotify = {
  roomCreated(): void {
    toast.success("ルームを作成しました");
  },
  joinedAsGuest(): void {
    toast.success("ルームに参加しました");
  },
};

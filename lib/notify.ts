// ドメイン文言を持たない汎用通知。sonner の toast を薄くラップする。
// ドメインの文言を持つ通知は各 feature の notify（例:
// features/room/room-notify.ts）に置き、lib はドメインを知らないままにする。
"use client";

import { toast } from "sonner";

export const notify = {
  error(message: string): void {
    toast.error(message);
  },
};

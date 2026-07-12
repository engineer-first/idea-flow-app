// lifecycleNotify ヘルパの単体テスト。sonner の toast 関数をモックして、
// 作成・参加フローの通知文言と呼び出しが期待通りであることを検証する。
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  // toast は関数 + success プロパティを持つオブジェクト
  toast: Object.assign(mocks.toast, {
    success: mocks.success,
  }),
}));

import { lifecycleNotify } from "./lifecycle-notify";

describe("lifecycleNotify", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.success.mockReset();
  });

  it("roomCreated は toast.success を「ルームを作成しました」で呼ぶ", () => {
    lifecycleNotify.roomCreated();
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith("ルームを作成しました");
  });

  it("joinedAsGuest は toast.success で「ルームに参加しました」を呼ぶ", () => {
    lifecycleNotify.joinedAsGuest();
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith("ルームに参加しました");
  });
});

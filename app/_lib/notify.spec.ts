// notify ヘルパの単体テスト。sonner の toast 関数をモックして、
// アプリ内通知の文言と呼び出しが期待通りであることを検証する。
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  // toast は関数 + success/error プロパティを持つオブジェクト
  toast: Object.assign(mocks.toast, {
    success: mocks.success,
    error: mocks.error,
  }),
}));

import { notify } from "@/app/_lib/notify";

describe("notify", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
  });

  it("roomCreated は toast.success を「ルームを作成しました」で呼ぶ", () => {
    notify.roomCreated();
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith("ルームを作成しました");
  });

  it("memberJoined は toast を「Taro さんが参加しました」で呼ぶ", () => {
    notify.memberJoined("Taro");
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("Taro さんが参加しました");
  });

  it("memberLeft は toast を「Taro さんが退出しました」で呼ぶ", () => {
    notify.memberLeft("Taro");
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("Taro さんが退出しました");
  });

  it("joinedAsHost / joinedAsGuest は toast.success で「ルームに参加しました」を呼ぶ", () => {
    notify.joinedAsHost();
    notify.joinedAsGuest();
    expect(mocks.success).toHaveBeenCalledTimes(2);
  });

  it("roomLeft は toast を「ルームから退出しました」で呼ぶ", () => {
    notify.roomLeft();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("ルームから退出しました");
  });

  it("roomDisbanded は toast を「ルームが解散されました」で呼ぶ", () => {
    notify.roomDisbanded();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("ルームが解散されました");
  });

  it("roomDisbandedBySelf は toast を「ルームを解散しました」で呼ぶ", () => {
    notify.roomDisbandedBySelf();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("ルームを解散しました");
  });

  it("error は toast.error でメッセージを表示する", () => {
    notify.error("失敗しました");
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith("失敗しました");
  });
});

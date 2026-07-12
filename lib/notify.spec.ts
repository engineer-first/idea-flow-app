// 汎用 notify ヘルパの単体テスト。sonner の toast 関数をモックして、
// 呼び出しが期待通りであることを検証する。
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  // toast は関数 + error プロパティを持つオブジェクト
  toast: Object.assign(mocks.toast, {
    error: mocks.error,
  }),
}));

import { notify } from "./notify";

describe("notify", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.error.mockReset();
  });

  it("error は toast.error でメッセージを表示する", () => {
    notify.error("失敗しました");
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith("失敗しました");
  });
});

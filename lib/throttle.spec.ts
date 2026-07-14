import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottled } from "@/lib/throttle";

describe("createThrottled", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("最初の呼び出しは即座に実行する（リーディングエッジ）", () => {
    const fn = vi.fn();
    const throttled = createThrottled(fn, 80);

    throttled(1);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);
  });

  it("インターバル内の連続呼び出しは間引き、最後の引数だけ遅延実行する（トレーリングエッジ）", () => {
    const fn = vi.fn();
    const throttled = createThrottled(fn, 80);

    throttled(1);
    throttled(2);
    throttled(3);

    // リーディングエッジの1回のみ
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(80);

    // トレーリングエッジで最後の引数が実行される
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it("インターバルを空けて呼び出すと毎回即座に実行する", () => {
    const fn = vi.fn();
    const throttled = createThrottled(fn, 80);

    throttled(1);
    vi.advanceTimersByTime(100);
    throttled(2);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 2);
  });

  it("cancel() は保留中のトレーリング実行を破棄する", () => {
    const fn = vi.fn();
    const throttled = createThrottled(fn, 80);

    throttled(1);
    throttled(2);
    throttled.cancel();

    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// 付箋ドラッグ中のブロードキャスト頻度を間引くための汎用スロットル関数。
// リーディングエッジ（呼び出し直後に即実行）とトレーリングエッジ（インターバル終端で
// 最後の引数を使って再実行）の両方を行う。これにより「動き始め」の反応と
// 「止まった位置」の最終同期の両方を保ちつつ、ネットワーク送信回数を抑える。
export type Throttled<Args extends unknown[]> = ((...args: Args) => void) & {
  cancel: () => void;
};

export function createThrottled<Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number,
): Throttled<Args> {
  let lastInvokedAt = -Infinity;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  function invoke(args: Args) {
    lastInvokedAt = Date.now();
    fn(...args);
  }

  function throttled(...args: Args) {
    const elapsed = Date.now() - lastInvokedAt;

    if (elapsed >= intervalMs) {
      invoke(args);
      return;
    }

    pendingArgs = args;

    if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (pendingArgs) {
          const args = pendingArgs;
          pendingArgs = null;
          invoke(args);
        }
      }, intervalMs - elapsed);
    }
  }

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingArgs = null;
  };

  return throttled;
}

// ホーム画面用のエラー表示（molecule）。
// role=alert でスクリーンリーダーに即時伝える。
export type HomeErrorAlertProps = {
  message: string;
};

export function HomeErrorAlert({ message }: HomeErrorAlertProps) {
  return (
    <p
      role="alert"
      data-testid="home-error-alert"
      className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

// ホーム画面用のエラー表示（molecule）。
// shadcn Alert の default バリアントで、色の強調なしのシンプルな通知にする。
import { Alert, AlertDescription } from "@/components/ui/alert";

export type HomeErrorAlertProps = {
  message: string;
};

export function HomeErrorAlert({ message }: HomeErrorAlertProps) {
  return (
    <Alert data-testid="home-error-alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

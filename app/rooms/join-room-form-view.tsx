// 招待コード参加フォームの表示専用。
// 入力・確認 Dialog・pending 文言はすべて props で固定する（Storybook / テスト用）。
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type JoinRoomFormViewProps = {
  code: string;
  onCodeChange: (code: string) => void;
  // lookup 中（「確認中…」）。
  lookingUp?: boolean;
  // join 確定処理中（「参加中…」）。
  joining?: boolean;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  // 確認 Dialog のホスト名（空ならフォールバック文言）。
  hostName: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
};

export function JoinRoomFormView({
  code,
  onCodeChange,
  lookingUp = false,
  joining = false,
  dialogOpen,
  onDialogOpenChange,
  hostName,
  onSubmit,
  onConfirm,
}: JoinRoomFormViewProps) {
  const isValidCode = /^[A-Z0-9]{6}$/.test(code);

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        data-testid="join-room-form"
      >
        <Field>
          <FieldLabel htmlFor="code">招待コード</FieldLabel>
          <Input
            id="code"
            name="code"
            value={code}
            onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
            maxLength={6}
            placeholder="AB12CD"
            autoComplete="off"
            required
            spellCheck={false}
            className="h-11 font-mono text-center text-base tracking-[0.35em] uppercase"
          />
          <FieldDescription>英数字 6 桁（大文字に自動変換）</FieldDescription>
        </Field>
        <Button
          type="submit"
          variant="outline"
          size="lg"
          disabled={!isValidCode || lookingUp}
          className="w-full"
        >
          {lookingUp ? "確認中…" : "参加する"}
        </Button>
      </form>

      <AlertDialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hostName
                ? `${hostName} さんが作成したルームに参加しますか？`
                : "このルームに参加しますか？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              招待コード{" "}
              <span className="font-mono font-semibold tracking-wider">
                {code}
              </span>{" "}
              のルームに参加します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={joining}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
              disabled={joining}
              data-testid="join-confirm-action"
            >
              {joining ? "参加中…" : "参加する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";

// ホストの「次のフェーズへ」操作の確認 Dialog（トリガーボタン込み）。
// フェーズ移行は付箋の整理を伴う不可逆な操作なので、必ず確認を挟む。
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Phase } from "@/contracts/room-protocol";
import { PHASE_LABELS } from "../logic/phase-labels";

export type NextPhaseConfirmDialogProps = {
  phase: Phase;
  disabled: boolean;
  onConfirm: () => void;
};

export function NextPhaseConfirmDialog({
  phase,
  disabled,
  onConfirm,
}: NextPhaseConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" disabled={disabled}>
          次のフェーズへ
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>次のフェーズへ移行しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            {PHASE_LABELS[phase]}
            から次のフェーズへ移行します。
            移行すると現在の付箋が整理され、一部の内容が引き継がれない場合があります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>

          <AlertDialogAction onClick={onConfirm}>移行する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

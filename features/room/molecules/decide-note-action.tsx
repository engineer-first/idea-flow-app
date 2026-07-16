import { Button } from "@/components/ui/button";

export type DecideNoteActionProps = {
  x: number;
  y: number;
  onDecide: () => void;
};

// 表示条件は親のキャンバスが持つ。これは選択済み付箋の近くに置く操作だけを担う。
export function DecideNoteAction({ x, y, onDecide }: DecideNoteActionProps) {
  return (
    <Button
      type="button"
      size="sm"
      className="absolute z-30 shadow-md"
      style={{ left: x, top: Math.max(0, y - 36) }}
      onClick={onDecide}
    >
      これを「取り組む課題」に決定
    </Button>
  );
}

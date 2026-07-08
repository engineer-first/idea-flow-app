// Dialog / AlertDialog の単体テスト。
// Radix の Portal で body 直下にレンダリングされるため testing-library の
// screen.getByRole で取得できる。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

describe("Dialog", () => {
  it("Trigger を押すと DialogContent が表示される", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>タイトル</DialogTitle>
            <DialogDescription>説明文</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("タイトル")).toBeInTheDocument();
    expect(screen.getByText("説明文")).toBeInTheDocument();
  });

  it("Close ボタンで Dialog が閉じる", async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>タイトル</DialogTitle>
          <DialogClose>とじる</DialogClose>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "とじる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Footer が DialogContent 内に描画される", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>タイトル</DialogTitle>
          <DialogFooter>
            <button type="button">キャンセル</button>
            <button type="button">OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("キャンセル");
    expect(dialog).toHaveTextContent("OK");
  });
});

describe("AlertDialog", () => {
  it("Trigger を押すと AlertDialogContent が表示される", async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger>確認</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction>削除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "確認" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("Cancel ボタンで AlertDialog が閉じる", async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>確認</AlertDialogTitle>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Action ボタンで AlertDialog が閉じる", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>確認</AlertDialogTitle>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onAction}>OK</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

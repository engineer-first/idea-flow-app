// Card コンポーネントの単体テスト。
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

describe("Card", () => {
  it("CardHeader に data-slot が付き、子要素を描画する", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>タイトル</CardTitle>
          <CardDescription>説明</CardDescription>
        </CardHeader>
        <CardContent>本文</CardContent>
        <CardFooter>フッター</CardFooter>
      </Card>,
    );
    expect(screen.getByText("タイトル")).toBeInTheDocument();
    expect(screen.getByText("説明")).toBeInTheDocument();
    expect(screen.getByText("本文")).toBeInTheDocument();
    expect(screen.getByText("フッター")).toBeInTheDocument();
    expect(screen.getByText("タイトル").parentElement).toHaveAttribute(
      "data-slot",
      "card-header",
    );
  });

  it("CardTitle / CardDescription に data-slot が付く", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>タイトル</CardTitle>
          <CardDescription>説明</CardDescription>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByText("タイトル")).toHaveAttribute(
      "data-slot",
      "card-title",
    );
    expect(screen.getByText("説明")).toHaveAttribute(
      "data-slot",
      "card-description",
    );
  });

  it("className でスタイルをマージできる", () => {
    render(
      <Card data-testid="card" className="bg-red-500">
        <CardContent>本文</CardContent>
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass("bg-red-500");
  });
});

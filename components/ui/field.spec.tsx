// Field コンポーネントの単体テスト。
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

describe("Field", () => {
  it("FieldLabel / FieldDescription / FieldError が data-slot を持つ", () => {
    render(
      <Field>
        <FieldLabel htmlFor="email">メール</FieldLabel>
        <input id="email" />
        <FieldDescription>公開されません</FieldDescription>
        <FieldError>エラー</FieldError>
      </Field>,
    );
    expect(screen.getByText("メール")).toHaveAttribute(
      "data-slot",
      "field-label",
    );
    expect(screen.getByText("公開されません")).toHaveAttribute(
      "data-slot",
      "field-description",
    );
    expect(screen.getByText("エラー")).toHaveAttribute(
      "data-slot",
      "field-error",
    );
  });

  it("htmlFor で input と関連付けられる", () => {
    render(
      <Field>
        <FieldLabel htmlFor="name">名前</FieldLabel>
        <input id="name" />
      </Field>,
    );
    expect(screen.getByText("名前").tagName).toBe("LABEL");
    expect(screen.getByText("名前")).toHaveAttribute("for", "name");
  });
});

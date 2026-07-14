// MemberAvatar（イニシャル丸）の純粋ロジックの単体テスト。
// DOM を含む React コンポーネントの描画は testing-library ベースで別途検証する。
import { describe, expect, it } from "vitest";
import { initialsOf } from "./member-avatar";

describe("initialsOf", () => {
  it("名と姓（スペース区切り）なら先頭2トークンの頭文字を返す", () => {
    expect(initialsOf("Yuki Tanaka")).toBe("YT");
  });

  it("ミドルネームを含む3トークンでも先頭2トークンの頭文字を返す", () => {
    expect(initialsOf("Yuki Sato Tanaka")).toBe("YS");
  });

  it("前後に空白があっても先頭2トークンから取る", () => {
    expect(initialsOf("  Taro  Yamada  ")).toBe("TY");
  });

  it("小文字でも大文字化して返す", () => {
    expect(initialsOf("taro yamada")).toBe("TY");
  });

  it("1トークンだけの場合は文字列の先頭2文字を返す", () => {
    expect(initialsOf("Taro")).toBe("TA");
  });

  it("空文字は ?? を返す（フォールバック）", () => {
    expect(initialsOf("")).toBe("??");
  });

  it("空白だけは ?? を返す", () => {
    expect(initialsOf("   ")).toBe("??");
  });

  it("日本語名（姓名にスペース無し）でも先頭2文字を返す", () => {
    expect(initialsOf("田中裕樹")).toBe("田中");
  });
});

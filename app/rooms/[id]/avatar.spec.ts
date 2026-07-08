// Avatar（イニシャル丸）の純粋ロジックの単体テスト。
// DOM を含む React コンポーネントの描画は testing-library ベースで別途検証する。
import { describe, expect, it } from "vitest";
import { avatarColorClass, initialsOf } from "@/app/rooms/[id]/avatar";

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

describe("avatarColorClass", () => {
  it("空文字でも 6 色の中のいずれかを返す（クラッシュしない）", () => {
    expect(avatarColorClass("")).toMatch(
      /^bg-(blue|emerald|amber|rose|violet|sky)-500$/,
    );
  });

  it("同じ名前には同じ色を返す（決定論的）", () => {
    expect(avatarColorClass("Yuki Tanaka")).toBe(
      avatarColorClass("Yuki Tanaka"),
    );
  });

  it("明らかに違う名前には違う色が返る可能性が高い（ハッシュ分布の確認）", () => {
    const names = [
      "Yuki Tanaka",
      "Taro Yamada",
      "Hanako Sato",
      "Jiro Suzuki",
      "Saburo Kato",
      "Shiro Watanabe",
      "Goro Ito",
    ];
    const colors = new Set(names.map(avatarColorClass));
    // 6 色あるので、7 入力だと衝突がほぼ確実。3 色以上は別マージ。
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it("返り値は Tailwind の safelist 対象クラス（6 種）のいずれか", () => {
    const allowed = new Set([
      "bg-blue-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-rose-500",
      "bg-violet-500",
      "bg-sky-500",
    ]);
    for (const name of ["", "A", "Yuki Tanaka", "Taro Yamada"]) {
      expect(allowed.has(avatarColorClass(name))).toBe(true);
    }
  });
});

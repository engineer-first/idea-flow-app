// RoomMembers（アバター横並び）の単体テスト。
// データ層に依存しないプレゼンテーション層として、自分判定・省略表示・
// a11y 属性を検証する。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomMembers } from "@/app/rooms/[id]/room-members";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";

const ME = "11111111-1111-4111-8111-111111111111";

describe("RoomMembers", () => {
  it("空のメンバー一覧では何も表示されない（グループだけが残る）", () => {
    render(<RoomMembers members={[]} currentUserId={ME} />);
    expect(screen.getByRole("group", { name: "参加者" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("avatar")).toHaveLength(0);
  });

  it("メンバー数ぶんアバターが描画される", () => {
    render(<RoomMembers members={buildMembers(3)} currentUserId={ME} />);
    expect(screen.getAllByTestId("avatar")).toHaveLength(3);
  });

  it("自分には data-self='true' がつき、aria-label に「あなた」が付く", () => {
    const members = buildMembers(2, ME);
    render(<RoomMembers members={members} currentUserId={ME} />);
    const me = screen.getByLabelText(/あなた/);
    expect(me).toHaveAttribute("data-self", "true");
  });

  it("自分以外は data-self が付かない", () => {
    const members = buildMembers(2, ME);
    render(<RoomMembers members={members} currentUserId={ME} />);
    const others = screen
      .getAllByTestId("avatar")
      .filter((el) => el.getAttribute("data-self") !== "true");
    expect(others).toHaveLength(1);
  });

  it("maxVisible を超えると末尾が +N バッジに置き換わる", () => {
    render(
      <RoomMembers
        members={buildMembers(8)}
        currentUserId={ME}
        maxVisible={3}
      />,
    );
    expect(screen.getAllByTestId("avatar")).toHaveLength(3);
    expect(screen.getByLabelText("他 5 名")).toHaveTextContent("+5");
  });

  it("maxVisible と同数のときは +N バッジは出ない", () => {
    render(
      <RoomMembers
        members={buildMembers(3)}
        currentUserId={ME}
        maxVisible={3}
      />,
    );
    expect(screen.queryByLabelText(/他 \d+ 名/)).not.toBeInTheDocument();
  });

  it("自分自身も maxVisible の対象として数える（省略対象になる）", () => {
    // 仕様: 「自分だから特別に残す」はしない。可視性の公平性を優先。
    const members = buildMembers(5, ME);
    render(<RoomMembers members={members} currentUserId={ME} maxVisible={3} />);
    expect(screen.getAllByTestId("avatar")).toHaveLength(3);
    expect(screen.getByLabelText("他 2 名")).toHaveTextContent("+2");
  });

  it("group の a11y ロールで囲まれている（スクリーンリーダーが「参加者」ブロックと認識できる）", () => {
    render(<RoomMembers members={buildMembers(1)} currentUserId={ME} />);
    const group = screen.getByRole("group", { name: "参加者" });
    expect(within(group).getAllByTestId("avatar")).toHaveLength(1);
  });
});

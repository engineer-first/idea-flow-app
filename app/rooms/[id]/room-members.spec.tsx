// RoomMembers（Avatar + 名前・2 列グリッド）の単体テスト。
// データ層に依存しないプレゼンテーション層として、自分判定・ホスト表示・
// 省略表示・名前常時表示・a11y 属性を検証する。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  ROOM_MEMBERS_MAX_VISIBLE,
  RoomMembers,
} from "@/app/rooms/[id]/room-members";
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

  it("一覧は 2 列グリッドで並ぶ", () => {
    render(<RoomMembers members={buildMembers(4)} currentUserId={ME} />);
    expect(screen.getByTestId("room-members")).toHaveClass("grid-cols-2");
  });

  it("自分には data-self='true' がつき、aria-label に名前だけが出る（（あなた）なし）", () => {
    const members = buildMembers(2, ME);
    render(<RoomMembers members={members} currentUserId={ME} />);
    const me = screen.getByLabelText("Yuki Tanaka");
    expect(me).toHaveAttribute("data-self", "true");
    expect(me).toHaveAttribute("aria-label", "Yuki Tanaka");
  });

  it("自分以外は data-self が付かない", () => {
    const members = buildMembers(2, ME);
    render(<RoomMembers members={members} currentUserId={ME} />);
    const others = screen
      .getAllByTestId("avatar")
      .filter((el) => el.getAttribute("data-self") !== "true");
    expect(others).toHaveLength(1);
  });

  it("メンバー名（イニシャル）が Avatar 内に表示される（変更なし）", () => {
    render(<RoomMembers members={buildMembers(2)} currentUserId={ME} />);
    expect(screen.getByLabelText("Yuki Tanaka")).toBeInTheDocument();
    expect(screen.getByLabelText("Taro Yamada")).toBeInTheDocument();
  });

  it("メンバー名が Avatar の隣に常時表示される（ホバー不要）", () => {
    const members = buildMembers(2, ME);
    render(<RoomMembers members={members} currentUserId={ME} />);
    const group = screen.getByRole("group", { name: "参加者" });
    expect(within(group).getByText("Yuki Tanaka")).toBeInTheDocument();
    expect(within(group).getByText("Taro Yamada")).toBeInTheDocument();
  });

  it("自分メンバーに（あなた）文言は付かない（ring で識別）", () => {
    const members = buildMembers(2, ME);
    render(<RoomMembers members={members} currentUserId={ME} />);
    const meRow = screen.getByTestId(`member-row-${ME}`).textContent;
    expect(meRow).toContain("Yuki Tanaka");
    expect(meRow).not.toContain("（あなた）");
  });

  it("hostUserId に一致するメンバーの名前下に「ホスト」が出る", () => {
    const members = buildMembers(2, ME);
    const hostId = members.find((m) => m.userId !== ME)?.userId ?? ME;
    render(
      <RoomMembers members={members} currentUserId={ME} hostUserId={hostId} />,
    );
    expect(screen.getByTestId(`member-host-label-${hostId}`)).toHaveTextContent(
      "ホスト",
    );
    expect(
      screen.queryByTestId(`member-host-label-${ME}`),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(`member-row-${hostId}`)).toHaveAttribute(
      "data-host",
      "true",
    );
  });

  it("hostUserId 未指定ならホストラベルは出ない", () => {
    render(<RoomMembers members={buildMembers(2, ME)} currentUserId={ME} />);
    expect(screen.queryByText("ホスト")).not.toBeInTheDocument();
  });

  it("既定の maxVisible=8 を超えると +N バッジになる", () => {
    render(
      <RoomMembers
        members={buildMembers(ROOM_MEMBERS_MAX_VISIBLE + 3)}
        currentUserId={ME}
      />,
    );
    expect(screen.getAllByTestId("avatar")).toHaveLength(
      ROOM_MEMBERS_MAX_VISIBLE,
    );
    expect(screen.getByRole("button", { name: "他 3 名" })).toHaveTextContent(
      "+3",
    );
  });

  it("8 人ちょうどなら +N バッジは出ない", () => {
    render(
      <RoomMembers
        members={buildMembers(ROOM_MEMBERS_MAX_VISIBLE)}
        currentUserId={ME}
      />,
    );
    expect(screen.getAllByTestId("avatar")).toHaveLength(
      ROOM_MEMBERS_MAX_VISIBLE,
    );
    expect(screen.queryByLabelText(/他 \d+ 名/)).not.toBeInTheDocument();
  });

  it("maxVisible を超えると末尾が +N バッジに置き換わる", () => {
    render(
      <RoomMembers
        members={buildMembers(8)}
        currentUserId={ME}
        maxVisible={3}
      />,
    );
    // 一覧のアバター 3 + ダイアログ未表示
    expect(screen.getAllByTestId("avatar")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "他 5 名" })).toHaveTextContent(
      "+5",
    );
  });

  it("+N をクリックすると隠れメンバーのアイコンと名前だけの Dialog が開く", async () => {
    const user = userEvent.setup();
    const members = buildMembers(5, ME);
    render(
      <RoomMembers members={members} currentUserId={ME} maxVisible={3} />,
    );
    // 表示: index 0-2、隠れ: index 3-4 → Jiro Suzuki, Saburo Kato
    await user.click(screen.getByRole("button", { name: "他 2 名" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "他のメンバー" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Jiro Suzuki")).toBeInTheDocument();
    expect(within(dialog).getByText("Jiro Suzuki")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Saburo Kato")).toBeInTheDocument();
    expect(within(dialog).getByText("Saburo Kato")).toBeInTheDocument();
    // 一覧側に出ているメンバーは Dialog に出さない
    expect(within(dialog).queryByText("Yuki Tanaka")).not.toBeInTheDocument();
    // ホストラベルなどは出さない（アイコン + 名前のみ）
    expect(within(dialog).queryByText("ホスト")).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "他 2 名" })).toHaveTextContent(
      "+2",
    );
  });

  it("group の a11y ロールで囲まれている（スクリーンリーダーが「参加者」ブロックと認識できる）", () => {
    render(<RoomMembers members={buildMembers(1)} currentUserId={ME} />);
    const group = screen.getByRole("group", { name: "参加者" });
    expect(within(group).getAllByTestId("avatar")).toHaveLength(1);
  });
});

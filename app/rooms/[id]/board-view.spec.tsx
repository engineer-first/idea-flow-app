import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";

const ME = "11111111-1111-4111-8111-111111111111";

function setup(overrides: Partial<Parameters<typeof BoardView>[0]> = {}) {
  const props = {
    notes: buildNotes(2),
    inviteCode: "AB12CD",
    inviteUrl: "https://idea-flow.example/invite/AB12CD",
    phase: "phase1" as const,
    isHost: false,
    isNextPhasePending: false,
    draggingNoteId: null,
    members: buildMembers(2, ME),
    currentUserId: ME,
    hostUserId: ME,
    onNextPhase: vi.fn(),
    onAddNote: vi.fn(),
    onNoteDragStart: vi.fn(),
    onNoteDragMove: vi.fn(),
    onNoteDragEnd: vi.fn(),
    onNoteContentChange: vi.fn(),
    onNoteDelete: vi.fn(),
    onLeave: vi.fn(),
    isLeaving: false,
    onNoteVote: vi.fn(),
    onNoteVoteReset: vi.fn(),
    connectionStatus: "open" as const,
    ...overrides,
  };

  render(<BoardView {...props} />);

  return props;
}

// カード内の選択・ドラッグ・キー操作を受けるサーフェス（透明なbutton）。
function getNoteSurface(card: HTMLElement) {
  return within(card).getByRole("button", { name: "付箋" });
}

// pointerdown → pointerup を同じ座標で行う「移動なしのクリック」。
function clickNote(card: HTMLElement) {
  const surface = getNoteSurface(card);
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 10, clientY: 10 });
}

describe("BoardView", () => {
  it("host のとき招待URLと招待コードのラベルと値を表示する", () => {
    setup({
      isHost: true,
      inviteCode: "ZZ99XX",
      inviteUrl: "https://idea-flow.example/invite/ZZ99XX",
    });

    expect(screen.getByText("招待URL")).toBeInTheDocument();
    expect(screen.getByText("招待コード")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "招待URLをコピー" }),
    ).toHaveTextContent("https://idea-flow.example/invite/ZZ99XX");
    expect(
      screen.getByRole("button", { name: "招待コードをコピー" }),
    ).toHaveTextContent("ZZ99XX");
  });

  it("付箋を配置する", () => {
    setup({ notes: buildNotes(3) });

    expect(screen.getAllByTestId("note-card")).toHaveLength(3);
  });

  it("付箋が0件のときは空状態メッセージを表示する", () => {
    setup({ notes: [] });

    expect(screen.getByText("付箋がまだありません")).toBeInTheDocument();
  });

  it("付箋を追加ボタンでonAddNoteを呼ぶ", () => {
    const onAddNote = vi.fn();
    setup({ onAddNote });

    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    expect(onAddNote).toHaveBeenCalledTimes(1);
  });

  it("残り投票可能数を表示する", () => {
    setup({
      notes: buildNotes(2).map((note, index) => ({
        ...note,
        dotVotes: {
          subjective: {
            count: index === 0 ? 1 : 0,
            votedByMe: index === 0,
            ownCount: index === 0 ? 1 : 0,
          },
          objective: { count: index + 1, votedByMe: true, ownCount: 1 },
        },
      })),
    });

    expect(screen.getByText("主観 残り0")).toBeInTheDocument();
    expect(screen.getByText("客観 残り1")).toBeInTheDocument();
  });

  it("付箋のドット投票ボタンでonNoteVoteを呼ぶ", () => {
    const onNoteVote = vi.fn();
    setup({ onNoteVote });

    fireEvent.click(
      screen.getAllByRole("button", { name: "主観ドットを投票" })[0],
    );

    expect(onNoteVote).toHaveBeenCalledWith("note-1", "subjective");
  });

  describe("接続状態の表示", () => {
    it("接続確立中は接続中の表示を出す（loading）", () => {
      setup({ connectionStatus: "connecting" });

      expect(screen.getByRole("status")).toHaveTextContent("接続中");
    });

    it("切断中は再接続中の表示を出す（error）", () => {
      setup({ connectionStatus: "closed" });

      expect(screen.getByRole("status")).toHaveTextContent("再接続");
    });

    it("接続済みならインジケータを出さない（success）", () => {
      setup({ connectionStatus: "open" });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("未接続時の操作無効化", () => {
    // WebSocket が connecting / closed の間に編集させると、room-client が
    // 送信を黙って破棄するため「入力したのに再接続後のsnapshotで消える」
    // ことになる。未接続中はボタン・付箋の操作自体を無効化する。
    it.each([
      "connecting",
      "closed",
    ] as const)("%sの間は「付箋を追加」ボタンが無効化される", (connectionStatus) => {
      setup({ connectionStatus });

      expect(screen.getByRole("button", { name: "付箋を追加" })).toBeDisabled();
    });

    it("openの間は「付箋を追加」ボタンが有効", () => {
      setup({ connectionStatus: "open" });

      expect(
        screen.getByRole("button", { name: "付箋を追加" }),
      ).not.toBeDisabled();
    });

    it("closedの間は付箋をクリックしても選択されない", () => {
      setup({ connectionStatus: "closed" });

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);

      expect(first).not.toHaveAttribute("data-selected");
    });
  });

  describe("付箋の選択", () => {
    it("付箋をクリックすると選択され、ボード背景のクリックで解除される", () => {
      setup();

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);
      expect(first).toHaveAttribute("data-selected", "true");

      fireEvent.pointerDown(screen.getByTestId("board-canvas"), {
        pointerId: 1,
      });
      expect(first).not.toHaveAttribute("data-selected");
    });

    it("別の付箋をクリックすると選択が移る（同時に選択されるのは1枚だけ）", () => {
      setup();

      const [first, second] = screen.getAllByTestId("note-card");
      clickNote(first);
      clickNote(second);

      expect(first).not.toHaveAttribute("data-selected");
      expect(second).toHaveAttribute("data-selected", "true");
    });

    it("選択済みの付箋をもう一度クリックすると編集モードに入る", () => {
      setup();

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);
      clickNote(first);

      expect(within(first).getByRole("textbox")).toHaveFocus();
    });

    it("選択中の付箋でBackspaceを押すとonNoteDeleteを呼ぶ", () => {
      const onNoteDelete = vi.fn();
      setup({ onNoteDelete });

      const [first] = screen.getAllByTestId("note-card");
      clickNote(first);
      fireEvent.keyDown(getNoteSurface(first), { key: "Backspace" });

      expect(onNoteDelete).toHaveBeenCalledWith("note-1");
    });
  });

  describe("フェーズ移行", () => {
    it("ホストの場合のみ「次のフェーズへ」ボタンを表示する", () => {
      setup({ isHost: true });

      expect(
        screen.getByRole("button", { name: "次のフェーズへ" }),
      ).toBeInTheDocument();
    });

    it("フェーズ移行前に確認ダイアログを表示し、確認後にonNextPhaseを呼ぶ", () => {
      const onNextPhase = vi.fn();
      setup({ isHost: true, onNextPhase });

      fireEvent.click(screen.getByRole("button", { name: "次のフェーズへ" }));

      expect(
        screen.getByText("次のフェーズへ移行しますか？"),
      ).toBeInTheDocument();

      expect(onNextPhase).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "移行する" }));

      expect(onNextPhase).toHaveBeenCalledTimes(1);
    });
  });
});

describe("退出・解散ボタン", () => {
  it("ホストは「ルームを解散」ボタンが描画される", () => {
    setup({ isHost: true });
    expect(
      screen.getByRole("button", { name: "ルームを解散" }),
    ).toBeInTheDocument();
  });

  it("非ホストは「退出する」ボタンが描画される", () => {
    setup({ isHost: false });
    expect(
      screen.getByRole("button", { name: "退出する" }),
    ).toBeInTheDocument();
  });

  it("ホストの「ルームを解散」で確認 Dialog が開き、確定で onLeave が呼ばれる", async () => {
    const onLeave = vi.fn();
    const user = userEvent.setup();
    setup({ onLeave, isHost: true });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ルームを解散" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("ルームを解散しますか？")).toBeInTheDocument();
    await user.click(screen.getByTestId("leave-confirm-action"));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("「キャンセル」で Dialog が閉じて onLeave は呼ばれない", async () => {
    const onLeave = vi.fn();
    const user = userEvent.setup();
    setup({ onLeave, isHost: true });
    await user.click(screen.getByRole("button", { name: "ルームを解散" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("isLeaving=true のときホストボタンは disabled で文言が「解散中…」になる", () => {
    setup({ isLeaving: true, isHost: true });
    const button = screen.getByRole("button", { name: /解散/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("解散中…");
  });
});

describe("招待URL/コード（host 限定表示）", () => {
  it("非 host のとき招待URL/コードが出ない", () => {
    setup({
      isHost: false,
      inviteCode: "ZZ99XX",
      inviteUrl: "https://example/invite/ZZ99XX",
    });
    expect(screen.queryByText("ZZ99XX")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "招待URLをコピー" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "招待コードをコピー" }),
    ).not.toBeInTheDocument();
  });
});

describe("メンバー一覧（名前常時表示）", () => {
  it("メンバー名が Avatar の隣に常時表示される（ホバー不要）", () => {
    setup();
    // 自分
    expect(screen.getByText("Yuki Tanaka")).toBeInTheDocument();
    // 自分以外（fixture の NAMES[0] と NAMES[1]）
    expect(screen.getByText("Taro Yamada")).toBeInTheDocument();
  });

  it("自分メンバーは data-self と ring で識別し、（あなた）文言は出さない", () => {
    setup();
    const meRow = screen.getByTestId(`member-row-${ME}`);
    expect(meRow).toHaveAttribute("data-self", "true");
    expect(meRow.textContent).toContain("Yuki Tanaka");
    expect(meRow.textContent).not.toContain("（あなた）");
  });

  it("ホストの名前下に「ホスト」ラベルが出る", () => {
    setup({ hostUserId: ME });
    expect(screen.getByTestId(`member-host-label-${ME}`)).toHaveTextContent(
      "ホスト",
    );
  });

  it("ボード画面は最大 12 人（4×3）まで表示し、超過は +N になる", () => {
    // 13 人 → 表示 11 + +2
    setup({ members: buildMembers(13) });
    expect(screen.getAllByTestId("avatar")).toHaveLength(11);
    expect(screen.getByLabelText("他 2 名")).toBeInTheDocument();
  });

  it("12 人以下なら全員表示され +N は出ない", () => {
    setup({ members: buildMembers(5) });
    expect(screen.getAllByTestId("avatar")).toHaveLength(5);
    expect(screen.queryByLabelText(/他 \d+ 名/)).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildPhaseStep } from "@/contracts/phase.fixture";
import {
  buildMembers,
  buildNote,
  buildNotes,
} from "@/contracts/room-protocol.fixture";
import { RoomBoardView } from "./room-board-view";

const ME = "11111111-1111-4111-8111-111111111111";

function setup(overrides: Partial<Parameters<typeof RoomBoardView>[0]> = {}) {
  const props = {
    notes: buildNotes(2),
    inviteCode: "AB12CD",
    inviteUrl: "https://idea-flow.example/invite/AB12CD",
    phase: buildPhaseStep(1),
    timer: { status: "idle" } as const,
    timerServerOffsetMs: 0,
    isHost: false,
    isNextPhasePending: false,
    privateNotes: [],
    draggingNoteId: null,
    members: buildMembers(2, ME),
    currentUserId: ME,
    hostUserId: ME,
    onNextPhase: vi.fn(),
    onTimerStart: vi.fn(),
    onTimerPause: vi.fn(),
    onTimerResume: vi.fn(),
    onTimerExtend: vi.fn(),
    onTimerStop: vi.fn(),
    onAddPrivateNote: vi.fn(),
    onPrivateNoteContentChange: vi.fn(),
    onPrivateNoteDelete: vi.fn(),
    onPrivateNotePublish: vi.fn(),
    onPrivateNoteUnpublish: vi.fn(),
    onNoteDragStart: vi.fn(),
    onNoteDragMove: vi.fn(),
    onNoteDragEnd: vi.fn(),
    onNoteContentChange: vi.fn(),
    onNoteDelete: vi.fn(),
    onGroupCreate: vi.fn(),
    onGroupUpdateName: vi.fn(),
    onLeave: vi.fn(),
    isLeaving: false,
    onNoteVote: vi.fn(),
    onNoteVoteReset: vi.fn(),
    connectionStatus: "open" as const,
    groups: [],
    ...overrides,
  };

  render(<RoomBoardView {...props} />);

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

describe("RoomBoardView", () => {
  it("非ホストにはタイマー状態だけを表示し操作を出さない", () => {
    setup({
      isHost: false,
      timer: { status: "paused", remainingMs: 30_000, durationMs: 60_000 },
      timerServerOffsetMs: 0,
    });
    expect(screen.getByRole("timer")).toHaveTextContent("00:30");
    expect(screen.queryByRole("button", { name: "再開" })).toBeNull();
  });

  it("ホストのタイマー開始操作を onTimerStart へ渡す", () => {
    const onTimerStart = vi.fn();
    setup({ isHost: true, onTimerStart });
    fireEvent.click(screen.getByTestId("room-timer"));
    fireEvent.change(screen.getByLabelText("タイマー時間（分）"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("タイマー時間（秒）"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "開始" }));
    expect(onTimerStart).toHaveBeenCalledWith(90_000);
  });

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

    expect(screen.getByText("共有付箋はまだありません")).toBeInTheDocument();
  });

  it("ツールバーの付箋追加ボタンでonAddPrivateNoteを呼ぶ", () => {
    const onAddPrivateNote = vi.fn();
    setup({ onAddPrivateNote });

    fireEvent.click(screen.getByRole("button", { name: "付箋を追加" }));

    expect(onAddPrivateNote).toHaveBeenCalledTimes(1);
  });

  it("マイ付箋ドックをボード下端のオーバーレイとして配置する", () => {
    setup();

    expect(screen.getByTestId("board-frame")).toContainElement(
      screen.getByTestId("private-notes-dock"),
    );
    expect(screen.getByTestId("private-notes-dock")).toHaveClass(
      "absolute",
      "bottom-3",
    );
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

  it("Step 1-4 のホストは Step 1-5 へ進める", () => {
    setup({ isHost: true, phase: buildPhaseStep(4) });

    expect(
      screen.getByRole("button", { name: "次のステップへ" }),
    ).not.toBeDisabled();
  });

  it("Step 1-5 では投票結果をダイアログ表示し、閉じると元のボードで話し合える", () => {
    setup({
      phase: buildPhaseStep(5),
      members: buildMembers(2, ME),
      notes: buildNotes(4).map((note, index) => ({
        ...note,
        content: ["課題A", "課題B", "課題C", "課題D"][index],
        dotVotes: {
          subjective: {
            count: [2, 0, 0, 0][index],
            votedByMe: false,
            ownCount: 0,
          },
          objective: {
            count: [1, 5, 0, 0][index],
            votedByMe: false,
            ownCount: 0,
          },
        },
      })),
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("vote-result-ranking")).toBeInTheDocument();
    expect(screen.getByTestId("board-canvas")).toBeInTheDocument();
    expect(screen.getByText("総合ポイントが高い順")).toBeInTheDocument();
    expect(screen.getByText("1位")).toBeInTheDocument();
    expect(screen.getByText("2位")).toBeInTheDocument();
    expect(screen.getAllByText("3位")).toHaveLength(2);
    expect(screen.queryByText("TOP 3")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-canvas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "投票結果を表示" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
    ] as const)("%sの間はツールバーの「付箋を追加」ボタンが無効化される", (connectionStatus) => {
      setup({ connectionStatus });

      expect(screen.getByRole("button", { name: "付箋を追加" })).toBeDisabled();
    });

    it("openの間はツールバーの「付箋を追加」ボタンが有効", () => {
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

  describe("付箋のグループ化表示", () => {
    it("近くに置かれた複数の付箋がある場合、グループ枠が描画されること", () => {
      const note1 = buildNote({ id: "note-1", x: 100, y: 100 });
      const note2 = buildNote({ id: "note-2", x: 350, y: 100 }); // 隙間 50px (閾値 60px 以下)
      setup({
        notes: [note1, note2],
        phase: buildPhaseStep(3),
      });

      expect(screen.getByTestId("note-group-card")).toBeInTheDocument();
      expect(screen.getByText("グループ")).toBeInTheDocument();
    });

    it("離れた位置に置かれた複数の付箋がある場合、グループ枠は描画されないこと", () => {
      const note1 = buildNote({ id: "note-1", x: 100, y: 100 });
      const note2 = buildNote({ id: "note-2", x: 361, y: 100 }); // 隙間 61px (閾値 60px 超)
      setup({
        notes: [note1, note2],
        phase: buildPhaseStep(3),
      });

      expect(screen.queryByTestId("note-group-card")).not.toBeInTheDocument();
    });

    it("グループ内の付箋に名前が紐づいている場合、その名前でグループが表示されること", () => {
      const note1 = buildNote({ id: "note-1", x: 100, y: 100 });
      const note2 = buildNote({ id: "note-2", x: 350, y: 100 });
      setup({
        notes: [note1, note2],
        phase: buildPhaseStep(3),
        groups: [
          {
            id: "g1",
            name: "カスタム課題グループ",
            noteIds: ["note-1", "note-2"],
          },
        ],
      });

      expect(screen.getByText("カスタム課題グループ")).toBeInTheDocument();
    });

    it("無名の仮グループに名前を入力して確定すると onGroupCreate が呼ばれること", () => {
      const onGroupCreate = vi.fn();
      const note1 = buildNote({ id: "note-1", x: 100, y: 100 });
      const note2 = buildNote({ id: "note-2", x: 350, y: 100 });
      setup({
        notes: [note1, note2],
        phase: buildPhaseStep(3),
        onGroupCreate,
      });

      // ラベルをクリックして編集モードにする
      const label = screen.getByText("グループ");
      fireEvent.click(label);

      // input要素が表示されることを確認
      const input = screen.getByTestId("group-name-input");
      expect(input).toBeInTheDocument();

      // 値を入力してEnterキーを押下
      fireEvent.change(input, { target: { value: "新規グループ名" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // onGroupCreate コールバックが呼ばれ、名前と noteIds が渡されること
      expect(onGroupCreate).toHaveBeenCalledWith("新規グループ名", [
        "note-1",
        "note-2",
      ]);
    });

    it("既存グループの名前を編集して確定すると onGroupUpdateName が呼ばれること", () => {
      const onGroupUpdateName = vi.fn();
      const note1 = buildNote({ id: "note-1", x: 100, y: 100 });
      const note2 = buildNote({ id: "note-2", x: 350, y: 100 });
      setup({
        notes: [note1, note2],
        phase: buildPhaseStep(3),
        groups: [
          { id: "g1", name: "元々の名前", noteIds: ["note-1", "note-2"] },
        ],
        onGroupUpdateName,
      });

      const label = screen.getByText("元々の名前");
      fireEvent.click(label);

      const input = screen.getByTestId("group-name-input");
      fireEvent.change(input, { target: { value: "新しい名前" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onGroupUpdateName).toHaveBeenCalledWith("g1", "新しい名前");
    });
  });

  describe("ステップ移行", () => {
    it("ホストの場合のみ「次のステップへ」ボタンを表示する", () => {
      setup({ isHost: true });

      expect(
        screen.getByRole("button", { name: "次のステップへ" }),
      ).toBeInTheDocument();
    });

    it("ステップ移行前に確認ダイアログを表示し、確認後にonNextPhaseを呼ぶ", () => {
      const onNextPhase = vi.fn();
      setup({ isHost: true, onNextPhase });

      fireEvent.click(screen.getByRole("button", { name: "次のステップへ" }));

      expect(
        screen.getByText("次のステップへ進みますか？"),
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

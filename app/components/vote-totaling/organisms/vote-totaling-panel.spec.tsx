import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";
import type { Note } from "@/app/rooms/notes-reducer";
import {
  calculateVoteTotaling,
  VoteTotalingPanel,
} from "./vote-totaling-panel";

const ME = "11111111-1111-4111-8111-111111111111";

function withVotes(note: Note, subjective: number, objective: number): Note {
  return {
    ...note,
    dotVotes: {
      subjective: { count: subjective, votedByMe: false, ownCount: 0 },
      objective: { count: objective, votedByMe: false, ownCount: 0 },
    },
  };
}

describe("calculateVoteTotaling", () => {
  it("主観5点・客観1点で集計し、同点なら主観票が多い付箋を取り組む課題にする", () => {
    const votes = [
      [2, 3],
      [2, 3],
      [2, 3],
      [1, 8],
      [0, 13],
      [1, 0],
      [1, 0],
      [1, 0],
    ];
    const notes = buildNotes(8).map((note, index) =>
      withVotes(note, votes[index][0], votes[index][1]),
    );
    const result = calculateVoteTotaling({ notes, memberCount: 10 });

    expect(result.isComplete).toBe(true);
    expect(result.rows.map((row) => row.score)).toEqual([
      13, 13, 13, 13, 13, 5, 5, 5,
    ]);
    expect(result.selectedChallenges.map((row) => row.noteId)).toEqual([
      "note-1",
      "note-2",
      "note-3",
    ]);
  });

  it("全員分の投票が終わるまでは結果を確定しない", () => {
    const [note] = buildNotes(1);
    const result = calculateVoteTotaling({
      notes: [withVotes(note, 1, 3)],
      memberCount: 2,
    });

    expect(result.isComplete).toBe(false);
    expect(result.selectedChallenges).toEqual([]);
  });

  it("主観票なしの首位があっても、主観票ありの最上位を取り組む課題にする", () => {
    const votes = [
      [0, 20],
      [2, 3],
      [2, 0],
      [2, 0],
      [2, 0],
      [2, 0],
      [0, 7],
    ];
    const notes = buildNotes(7).map((note, index) =>
      withVotes(note, votes[index][0], votes[index][1]),
    );

    const result = calculateVoteTotaling({ notes, memberCount: 10 });

    expect(result.isComplete).toBe(true);
    expect(result.rows[0]).toMatchObject({
      noteId: "note-1",
      subjectiveCount: 0,
      score: 20,
    });
    expect(result.selectedChallenges.map((row) => row.noteId)).toEqual([
      "note-2",
    ]);
  });

  it("無投票の付箋も総合ポイント0としてランキングに含める", () => {
    const votes = [
      [2, 0],
      [0, 3],
      [0, 2],
      [0, 1],
      [0, 0],
    ];
    const notes = buildNotes(5).map((note, index) =>
      withVotes(note, votes[index][0], votes[index][1]),
    );

    const result = calculateVoteTotaling({ notes, memberCount: 2 });

    expect(result.isComplete).toBe(true);
    expect(result.rows.map((row) => row.score)).toEqual([10, 3, 2, 1, 0]);
    expect(result.rows.map((row) => row.noteId)).toEqual([
      "note-1",
      "note-2",
      "note-3",
      "note-4",
      "note-5",
    ]);
  });
});

describe("VoteTotalingPanel", () => {
  it("phase4 で確定済みなら、参加者が離脱しても結果を表示し続ける", () => {
    const [note] = buildNotes(1);

    render(
      <VoteTotalingPanel
        isVotingComplete
        members={[]}
        notes={[withVotes(note, 1, 3)]}
      />,
    );

    expect(screen.getByTestId("vote-result-ranking")).toBeInTheDocument();
  });

  it("すべての付箋を総合ポイント順に表示し、無投票の付箋も含める", () => {
    const notes = buildNotes(5).map((note, index) =>
      withVotes(note, [2, 0, 0, 0, 0][index], [0, 3, 2, 1, 0][index]),
    );

    render(<VoteTotalingPanel members={buildMembers(2, ME)} notes={notes} />);

    expect(screen.getByTestId("vote-result-ranking")).toHaveClass("mx-auto");
    expect(screen.getByText("総合ポイントが高い順")).toBeInTheDocument();
    expect(screen.getByText("取り組む課題")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId(/vote-totaling-row-/)
        .map((row) => row.dataset.testid),
    ).toEqual([
      "vote-totaling-row-note-1",
      "vote-totaling-row-note-2",
      "vote-totaling-row-note-3",
      "vote-totaling-row-note-4",
      "vote-totaling-row-note-5",
    ]);
    expect(screen.getByText("5位")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("vote-totaling-row-note-1")).getByText("10点"),
    ).toBeInTheDocument();
  });
});

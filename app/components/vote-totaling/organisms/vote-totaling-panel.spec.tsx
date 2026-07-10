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
  it("全員分の投票後、投票済み付箋だけを合計票数の降順に並べる", () => {
    const notes = buildNotes(5).map((note, index) =>
      withVotes(note, [2, 0, 0, 0, 0][index], [0, 3, 2, 1, 0][index]),
    );
    const result = calculateVoteTotaling({ notes, memberCount: 2 });

    expect(result.isComplete).toBe(true);
    expect(result.rows.map((row) => row.noteId)).toEqual([
      "note-2",
      "note-1",
      "note-3",
      "note-4",
    ]);
    expect(result.rows.map((row) => row.voteCount)).toEqual([3, 2, 2, 1]);
  });

  it("全員分の投票が終わるまでは結果を確定しない", () => {
    const [note] = buildNotes(1);
    const result = calculateVoteTotaling({
      notes: [withVotes(note, 1, 3)],
      memberCount: 2,
    });

    expect(result.isComplete).toBe(false);
  });

  it("合計票数が同じ付箋も、投票済みなら集計対象にする", () => {
    const votes = [
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 2],
      [0, 1],
    ];
    const notes = buildNotes(5).map((note, index) =>
      withVotes(note, votes[index][0], votes[index][1]),
    );

    const result = calculateVoteTotaling({ notes, memberCount: 3 });

    expect(result.isComplete).toBe(true);
    expect(result.rows.map((row) => row.voteCount)).toEqual([4, 3, 2, 2, 1]);
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
  it("投票済みの全付箋を投票数順に表示し、未投票の付箋は表示しない", () => {
    const notes = buildNotes(5).map((note, index) =>
      withVotes(note, [2, 0, 0, 0, 0][index], [0, 3, 2, 1, 0][index]),
    );

    render(<VoteTotalingPanel members={buildMembers(2, ME)} notes={notes} />);

    expect(screen.getByTestId("vote-result-ranking")).toHaveClass("mx-auto");
    expect(screen.getByText("投票数が多い順")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId(/vote-totaling-row-/)
        .map((row) => row.dataset.testid),
    ).toEqual([
      "vote-totaling-row-note-2",
      "vote-totaling-row-note-1",
      "vote-totaling-row-note-3",
      "vote-totaling-row-note-4",
    ]);
    expect(screen.getAllByText("2位")).toHaveLength(2);
    expect(
      screen.queryByTestId("vote-totaling-row-note-5"),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("vote-totaling-row-note-2")).getByText(
        "合計 3",
      ),
    ).toBeInTheDocument();
  });
});

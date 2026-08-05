import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DotVoteControls } from "./dot-vote-controls";

describe("DotVoteControls", () => {
  it("ステルス投票中は総数が未公開でも、自分が置いたドット数を表示する", () => {
    render(
      <DotVoteControls
        noteId="note-1"
        dotVotes={{
          subjective: { votedByMe: true, ownCount: 1 },
          objective: { votedByMe: true, ownCount: 3 },
        }}
        voteRemaining={{ subjective: 0, objective: 0 }}
        onVote={vi.fn()}
        onVoteReset={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "主観ドット投票を取り消す" }),
    ).toHaveTextContent("主観1");
    expect(
      screen.getByRole("button", { name: "客観ドットを追加" }),
    ).toHaveTextContent("客観3");
  });
});

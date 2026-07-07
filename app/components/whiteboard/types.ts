import type { VoteRecord, VoteType } from "@/app/whiteboard/vote-state";

export type NoteTarget = {
  noteId: string;
  title: string;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type RemainingVotes = {
  subjective: number;
  objective: number;
};

export type { VoteRecord, VoteType };

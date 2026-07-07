import type { NoteTarget, VoteRecord } from "../types";

type VoteCanvasOverlayProps = {
  noteTargets: NoteTarget[];
  votes: VoteRecord[];
};

export function VoteCanvasOverlay({
  noteTargets,
  votes,
}: VoteCanvasOverlayProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 15,
      }}
    >
      {noteTargets.map((target) => {
        const noteVotes = votes.filter(
          (vote) => vote.stickyNoteId === target.noteId,
        );
        const subjectiveCount = noteVotes.filter(
          (vote) => vote.voteType === "subjective",
        ).length;
        const objectiveCount = noteVotes.filter(
          (vote) => vote.voteType === "objective",
        ).length;

        return (
          <div
            key={target.noteId}
            style={{
              position: "absolute",
              left: target.bounds.left,
              top: target.bounds.top,
              width: target.bounds.width,
              height: target.bounds.height,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                display: "flex",
                gap: 4,
                pointerEvents: "none",
              }}
            >
              {subjectiveCount > 0 ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(239, 68, 68, 0.9)",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  S{subjectiveCount}
                </span>
              ) : null}
              {objectiveCount > 0 ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(37, 99, 235, 0.9)",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  O{objectiveCount}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

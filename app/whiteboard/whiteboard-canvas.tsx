"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createTLStore,
  defaultShapeUtils,
  renderPlaintextFromRichText,
  type Editor,
  type TLRecord,
  Tldraw,
} from "tldraw";
import "tldraw/tldraw.css";
import { createClient } from "@/lib/supabase/client";
import {
  applyVote,
  getCurrentUserId,
  getRemainingVotes,
  loadVotesFromStorage,
  saveVotesToStorage,
  type VoteRecord,
  type VoteType,
} from "./vote-state";

const CHANNEL_NAME = "whiteboard-poc";
const EVENT_NAME = "store-update";

type StoreUpdatePayload = {
  added: TLRecord[];
  updated: TLRecord[];
  removed: string[];
};

type NoteTarget = {
  noteId: string;
  title: string;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

function getNoteTitle(editor: Editor, shape: { type: string; props: any }) {
  if (shape.type !== "note") {
    return "付箋";
  }

  try {
    const text = renderPlaintextFromRichText(editor, shape.props.richText);
    return text.trim().split("\n")[0] || "付箋";
  } catch {
    return "付箋";
  }
}

function getNoteTargets(editor: Editor): NoteTarget[] {
  return editor.getCurrentPageShapes().flatMap((shape) => {
    if (shape.type !== "note") {
      return [];
    }

    const bounds = editor.getShapePageBounds(shape);
    if (!bounds) {
      return [];
    }

    const topLeft = editor.pageToScreen({ x: bounds.minX, y: bounds.minY });
    const bottomRight = editor.pageToScreen({ x: bounds.maxX, y: bounds.maxY });

    return [
      {
        noteId: shape.id as string,
        title: getNoteTitle(editor, shape),
        bounds: {
          left: topLeft.x,
          top: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
      },
    ];
  });
}

export default function WhiteboardCanvas() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [storeVersion, setStoreVersion] = useState(0);
  const [store] = useState(() =>
    createTLStore({
      shapeUtils: defaultShapeUtils,
      onMount: (editorInstance) => {
        setEditor(editorInstance);
        return () => setEditor(null);
      },
    }),
  );
  const [supabase] = useState(() => createClient());
  const [votes, setVotes] = useState<VoteRecord[]>(() => loadVotesFromStorage());
  const [feedback, setFeedback] = useState<string>("");
  const [activeMode, setActiveMode] = useState<VoteType | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draggedVoteId, setDraggedVoteId] = useState<string | null>(null);
  const [dragOverNoteId, setDragOverNoteId] = useState<string | null>(null);
  const userId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    saveVotesToStorage(votes);
  }, [votes]);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME);

    channel.on(
      "broadcast",
      { event: EVENT_NAME },
      ({ payload }: { payload: StoreUpdatePayload }) => {
        store.mergeRemoteChanges(() => {
          if (payload.added.length > 0) {
            store.put(payload.added);
          }
          if (payload.updated.length > 0) {
            store.put(payload.updated);
          }
          if (payload.removed.length > 0) {
            store.remove(payload.removed as TLRecord["id"][]);
          }
        });
      },
    );

    channel.subscribe();

    const unlisten = store.listen(
      (entry) => {
        const added = Object.values(entry.changes.added);
        const updated = Object.values(entry.changes.updated).map(
          ([, next]) => next,
        );
        const removed = Object.keys(entry.changes.removed);

        if (
          added.length === 0 &&
          updated.length === 0 &&
          removed.length === 0
        ) {
          return;
        }

        const payload: StoreUpdatePayload = { added, updated, removed };

        channel.send({
          type: "broadcast",
          event: EVENT_NAME,
          payload,
        });
      },
      { source: "user", scope: "document" },
    );

    return () => {
      unlisten();
      supabase.removeChannel(channel);
    };
  }, [store, supabase]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleUpdate = () => {
      setStoreVersion((version) => version + 1);
    };

    editor.on("frame", handleUpdate);
    editor.on("resize", handleUpdate);

    const unlistenStore = store.listen(() => {
      setStoreVersion((version) => version + 1);
    });

    return () => {
      editor.off("frame", handleUpdate);
      editor.off("resize", handleUpdate);
      unlistenStore();
    };
  }, [editor, store]);

  const noteTargets = useMemo(
    () => (editor ? getNoteTargets(editor) : []),
    [editor, storeVersion],
  );

  const currentNoteIds = useMemo(
    () => noteTargets.map((note) => note.noteId),
    [noteTargets],
  );

  useEffect(() => {
    if (noteTargets.length === 0) {
      setSelectedNoteId(null);
      return;
    }

    if (selectedNoteId && noteTargets.some((note) => note.noteId === selectedNoteId)) {
      return;
    }

    setSelectedNoteId(noteTargets[0].noteId);
  }, [noteTargets, selectedNoteId]);

  const remaining = useMemo(
    () => getRemainingVotes(votes, currentNoteIds),
    [votes, currentNoteIds],
  );

  const handleVoteDragStart = (voteId: string) => {
    setDraggedVoteId(voteId);
  };

  const handleVoteDragEnd = () => {
    setDraggedVoteId(null);
  };

  const moveVoteToNote = (voteId: string, targetNoteId: string) => {
    setVotes((currentVotes) =>
      currentVotes.map((vote) =>
        vote.id === voteId ? { ...vote, stickyNoteId: targetNoteId } : vote,
      ),
    );
    setFeedback("ドットを移動しました。");
  };

  const removeVote = (voteId: string) => {
    setVotes((currentVotes) => currentVotes.filter((vote) => vote.id !== voteId));
    setFeedback("ドットを削除しました。");
  };

  const removeVoteOfType = (stickyNoteId: string, voteType: VoteType) => {
    setVotes((currentVotes) => {
      const voteIndex = currentVotes.findIndex(
        (vote) => vote.stickyNoteId === stickyNoteId && vote.voteType === voteType,
      );
      if (voteIndex === -1) {
        return currentVotes;
      }
      const nextVotes = [...currentVotes];
      nextVotes.splice(voteIndex, 1);
      return nextVotes;
    });
    setFeedback(
      `${voteType === "subjective" ? "主観" : "客観"}ドットを削除しました。`,
    );
  };

  const handleNoteSelect = (stickyNoteId: string) => {
    if (!activeMode) {
      setFeedback("投票種別を選択してください。");
      return;
    }

    const nextState = applyVote(
      { votes },
      {
        id: `${stickyNoteId}-${activeMode}-${crypto.randomUUID()}`,
        userId,
        stickyNoteId,
        voteType: activeMode,
        createdAt: new Date().toISOString(),
      },
      currentNoteIds,
    );

    if (nextState.canVote === false) {
      setFeedback("この投票枠は使い切りました。");
      return;
    }

    setVotes(nextState.votes);
    setFeedback(
      `${activeMode === "subjective" ? "主観" : "客観"}ドットを配置しました。`,
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          padding: 16,
          gap: 12,
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #d0d7de",
            borderRadius: 12,
            padding: 12,
            width: "min(420px, calc(100vw - 32px))",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>投票状況</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            主観: 残り{remaining.subjective}票 / 客観: 残り{remaining.objective}票
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveMode("subjective")}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "6px 10px",
                background: activeMode === "subjective" ? "#ef4444" : "#f3f4f6",
                color: activeMode === "subjective" ? "#fff" : "#111827",
                cursor: "pointer",
              }}
            >
              🔴 主観
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("objective")}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "6px 10px",
                background: activeMode === "objective" ? "#2563eb" : "#f3f4f6",
                color: activeMode === "objective" ? "#fff" : "#111827",
                cursor: "pointer",
              }}
            >
              🔵 客観
            </button>
            <select
              value={selectedNoteId ?? ""}
              onChange={(event) => setSelectedNoteId(event.target.value)}
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              {noteTargets.map((target) => {
                const noteVotes = votes.filter((vote) => vote.stickyNoteId === target.noteId);
                const subjectiveDots = noteVotes.filter((vote) => vote.voteType === "subjective");
                const objectiveDots = noteVotes.filter((vote) => vote.voteType === "objective");
                return (
                  <option key={target.noteId} value={target.noteId}>
                    {target.title} ({subjectiveDots.length}/1 主観, {objectiveDots.length}/3 客観)
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!selectedNoteId) {
                  setFeedback("先に付箋を選択してください。");
                  return;
                }
                handleNoteSelect(selectedNoteId);
              }}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "6px 10px",
                background: "#22c55e",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              投票する
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedNoteId) {
                  setFeedback("先に付箋を選択してください。");
                  return;
                }
                removeVoteOfType(selectedNoteId, "subjective");
              }}
              style={{
                border: "1px solid #ef4444",
                borderRadius: 999,
                padding: "6px 10px",
                background: "#fff",
                color: "#ef4444",
                cursor: "pointer",
              }}
            >
              主観削除
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedNoteId) {
                  setFeedback("先に付箋を選択してください。");
                  return;
                }
                removeVoteOfType(selectedNoteId, "objective");
              }}
              style={{
                border: "1px solid #2563eb",
                borderRadius: 999,
                padding: "6px 10px",
                background: "#fff",
                color: "#2563eb",
                cursor: "pointer",
              }}
            >
              客観削除
            </button>
          </div>
          {feedback ? (
            <div style={{ fontSize: 13, marginBottom: 8 }}>{feedback}</div>
          ) : null}
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            付箋を選択して、選択中の投票種別のドットを配置できます。
          </div>
        </div>
        <div
          style={{
            pointerEvents: "auto",
            display: "grid",
            gap: 12,
            width: "min(900px, calc(100vw - 32px))",
          }}
        >
          <details
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: 14,
              color: "#334155",
            }}
          >
            <summary
              style={{
                cursor: noteTargets.length > 0 ? "pointer" : "default",
                fontWeight: 700,
                marginBottom: 10,
                outline: "none",
              }}
            >
              キャンバス上の付箋に投票
            </summary>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              付箋上でドットを確認し、ドラッグで別の付箋に移動できます。
            </div>
            {noteTargets.length === 0 ? (
              <div style={{ marginTop: 10, color: "#475569" }}>
                まだ付箋がありません。左のツールバーまたはペンツールで付箋を追加してください。
              </div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {noteTargets.map((target) => {
                  const noteVotes = votes.filter((vote) => vote.stickyNoteId === target.noteId);
                  const subjectiveDots = noteVotes.filter(
                    (vote) => vote.voteType === "subjective",
                  );
                  const objectiveDots = noteVotes.filter(
                    (vote) => vote.voteType === "objective",
                  );

                  return (
                    <div
                      key={target.noteId}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverNoteId(target.noteId);
                      }}
                      onDragLeave={() => setDragOverNoteId(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!draggedVoteId) {
                          return;
                        }
                        moveVoteToNote(draggedVoteId, target.noteId);
                        setDragOverNoteId(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: 10,
                        background: dragOverNoteId === target.noteId ? "#e0f2fe" : "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {target.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {subjectiveDots.length} / 1 主観, {objectiveDots.length} / 3 客観
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {noteVotes.map((vote) => (
                          <span
                            key={vote.id}
                            draggable
                            onDragStart={() => handleVoteDragStart(vote.id)}
                            onDragEnd={handleVoteDragEnd}
                            title={`ドラッグして別の付箋に移動 (${vote.voteType === "subjective" ? "主観" : "客観"})`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: vote.voteType === "subjective" ? "#ef4444" : "#2563eb",
                              color: "#ffffff",
                              fontSize: 12,
                              cursor: "grab",
                              userSelect: "none",
                              pointerEvents: "auto",
                            }}
                          >
                            {vote.voteType === "subjective" ? "S" : "O"}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                        {noteVotes.map((vote) => (
                          <button
                            key={`${vote.id}-remove`}
                            type="button"
                            onClick={() => removeVote(vote.id)}
                            style={{
                              border: "1px solid #cbd5e1",
                              borderRadius: 999,
                              padding: "4px 8px",
                              background: "#fff",
                              color: "#334155",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            {vote.voteType === "subjective" ? "主観削除" : "客観削除"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 15,
        }}
      >
        {noteTargets.map((target) => {
          const noteVotes = votes.filter((vote) => vote.stickyNoteId === target.noteId);
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
      <Tldraw store={store} />
    </div>
  );
}

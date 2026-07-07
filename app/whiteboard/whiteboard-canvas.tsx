"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createTLStore,
  defaultShapeUtils,
  type Editor,
  renderPlaintextFromRichText,
  type TLNoteShape,
  type TLRecord,
  Tldraw,
} from "tldraw";
import "tldraw/tldraw.css";
import { VoteControlPanel } from "@/app/components/whiteboard/molecules/vote-control-panel";
import { NoteVoteList } from "@/app/components/whiteboard/organisms/note-vote-list";
import { VoteCanvasOverlay } from "@/app/components/whiteboard/organisms/vote-canvas-overlay";
import type { NoteTarget } from "@/app/components/whiteboard/types";
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

function getNoteTitle(editor: Editor, shape: TLNoteShape) {
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
  const [, setStoreVersion] = useState(0);
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
  const [votes, setVotes] = useState<VoteRecord[]>(() =>
    loadVotesFromStorage(),
  );
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

  const noteTargets = editor ? getNoteTargets(editor) : [];

  const currentNoteIds = useMemo(
    () => noteTargets.map((note) => note.noteId),
    [noteTargets],
  );

  useEffect(() => {
    if (noteTargets.length === 0) {
      setSelectedNoteId(null);
      return;
    }

    if (
      selectedNoteId &&
      noteTargets.some((note) => note.noteId === selectedNoteId)
    ) {
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
    setVotes((currentVotes) =>
      currentVotes.filter((vote) => vote.id !== voteId),
    );
    setFeedback("ドットを削除しました。");
  };

  const removeVoteOfType = (stickyNoteId: string, voteType: VoteType) => {
    setVotes((currentVotes) => {
      const voteIndex = currentVotes.findIndex(
        (vote) =>
          vote.stickyNoteId === stickyNoteId && vote.voteType === voteType,
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

  const handleSelectedNoteVote = () => {
    if (!selectedNoteId) {
      setFeedback("先に付箋を選択してください。");
      return;
    }
    handleNoteSelect(selectedNoteId);
  };

  const handleRemoveSelectedVoteType = (voteType: VoteType) => {
    if (!selectedNoteId) {
      setFeedback("先に付箋を選択してください。");
      return;
    }
    removeVoteOfType(selectedNoteId, voteType);
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
        <VoteControlPanel
          activeMode={activeMode}
          feedback={feedback}
          noteTargets={noteTargets}
          remaining={remaining}
          selectedNoteId={selectedNoteId}
          votes={votes}
          onActiveModeChange={setActiveMode}
          onRemoveVoteType={handleRemoveSelectedVoteType}
          onSelectedNoteChange={setSelectedNoteId}
          onVote={handleSelectedNoteVote}
        />
        <NoteVoteList
          draggedVoteId={draggedVoteId}
          dragOverNoteId={dragOverNoteId}
          noteTargets={noteTargets}
          votes={votes}
          onDragOverNoteChange={setDragOverNoteId}
          onMoveVoteToNote={moveVoteToNote}
          onRemoveVote={removeVote}
          onVoteDragEnd={handleVoteDragEnd}
          onVoteDragStart={handleVoteDragStart}
        />
      </div>
      <VoteCanvasOverlay noteTargets={noteTargets} votes={votes} />
      <Tldraw store={store} />
    </div>
  );
}

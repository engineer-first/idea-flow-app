"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { NoteForm } from "../molecules/note-form";
import { Note } from "../molecules/note";
import type { Note as NoteType, Position } from "../../types/idea";

const initialPosition = { left: 24, top: 24 };
const noteWidth = 240;
const noteHeight = 160;

const createNote = (content: string, position: Position): NoteType => ({
  id: nanoid(),
  content,
  position,
});

type DragState = {
  id: string;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
};

export function Whiteboard() {
  const [input, setInput] = useState("");
  const [notes, setNotes] = useState<NoteType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [boardClickPosition, setBoardClickPosition] = useState<Position | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const addNote = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const nextPosition = {
      left: initialPosition.left + notes.length * 20,
      top: initialPosition.top + notes.length * 20,
    };

    const note = createNote(trimmed, nextPosition);
    setNotes((current) => [...current, note]);
    setInput("");
    setSelectedId(note.id);
    setEditingId(null);
    setBoardClickPosition(null);
  };

  const addNoteAtPosition = (position: Position) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const left = Math.max(0, Math.min(rect.width - noteWidth, position.left - noteWidth / 2));
    const top = Math.max(0, Math.min(rect.height - noteHeight, position.top - noteHeight / 2));
    const note = createNote("", { left, top });
    setNotes((current) => [...current, note]);
    setSelectedId(note.id);
    setEditingId(note.id);
    setBoardClickPosition(null);
  };

  const updateNote = (id: string, content: string) => {
    setNotes((current) =>
      current.map((note) =>
        note.id === id ? { ...note, content } : note
      )
    );
  };

  const updateNotePosition = (id: string, position: Position) => {
    setNotes((current) =>
      current.map((note) =>
        note.id === id ? { ...note, position } : note
      )
    );
  };

  const deleteSelectedNote = () => {
    if (!selectedId) return;
    setNotes((current) => current.filter((note) => note.id !== selectedId));
    setSelectedId(null);
    if (editingId === selectedId) {
      setEditingId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedId || editingId) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelectedNote();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingId]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      updateNotePosition(dragState.id, {
        left: Math.max(0, dragState.startLeft + deltaX),
        top: Math.max(0, dragState.startTop + deltaY),
      });
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const left = event.clientX - rect.left;
    const top = event.clientY - rect.top;
    setBoardClickPosition({ left, top });
    setSelectedId(null);
    setEditingId(null);
  };

  const handleToggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  const handleStartDrag = (id: string, position: Position, event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setDragState({
      id,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: position.left,
      startTop: position.top,
    });
    setSelectedId(id);
    setEditingId(null);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-8 px-6 py-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">アイデアボード</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              ブレスト画面で付箋を追加し、その場で編集・削除できます。ホワイトボードをクリックすると追加ポイントが表示されます。
            </p>
          </div>
          <button
            type="button"
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              sidebarOpen
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
            onClick={handleToggleSidebar}
          >
            {sidebarOpen ? "付箋一覧を閉じる" : "付箋一覧を開く"}
          </button>
        </div>

        <div className="mt-6 max-w-3xl">
          <NoteForm value={input} onChange={setInput} onSubmit={addNote} />
        </div>
      </section>

      <section className="flex min-h-[calc(100vh-240px)] gap-4">
        <div
          ref={boardRef}
          className="relative flex-1 overflow-hidden rounded-3xl border border-zinc-200 bg-slate-50 p-6 shadow-inner"
          onClick={handleBoardClick}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.1),_transparent_30%)]" />
          <div className="relative h-full w-full rounded-3xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.85),transparent_20%),linear-gradient(90deg,rgba(255,255,255,0.8),rgba(255,255,255,0.8))] p-2">
            {boardClickPosition && (
              <button
                type="button"
                className="absolute z-20 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700"
                style={{ left: boardClickPosition.left, top: boardClickPosition.top }}
                onClick={(event) => {
                  event.stopPropagation();
                  addNoteAtPosition(boardClickPosition);
                }}
              >
                付箋を追加
              </button>
            )}

            <div className="relative h-full w-full">
              {notes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-zinc-500">
                  <p className="text-lg font-medium">ここをクリックして付箋を追加</p>
                  <p className="mt-2 text-sm">ホワイトボードに追加したアイデアが表示されます。</p>
                </div>
              ) : null}
              {notes.map((note) => (
                <Note
                  key={note.id}
                  note={note}
                  selected={selectedId === note.id}
                  isEditing={editingId === note.id}
                  onClick={() => {
                    setSelectedId(note.id);
                    setEditingId(null);
                    setBoardClickPosition(null);
                  }}
                  onChange={(value) => updateNote(note.id, value)}
                  onToggleEdit={() => {
                    if (editingId === note.id) {
                      setEditingId(null);
                    } else {
                      setSelectedId(note.id);
                      setEditingId(note.id);
                    }
                    setBoardClickPosition(null);
                  }}
                  onStartDrag={(event) => handleStartDrag(note.id, note.position, event)}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className={`flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white transition-all duration-300 ${sidebarOpen ? "w-[320px] shadow-2xl" : "w-20"}`}>
          <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4">
            {sidebarOpen ? (
              <span className="text-sm font-semibold text-zinc-900">付箋一覧</span>
            ) : (
              <div />
            )}
            <button
              type="button"
              className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
              onClick={handleToggleSidebar}
            >
              {sidebarOpen ? "閉じる" : ">"}
            </button>
          </div>
          <div className={`flex-1 overflow-y-auto transition-opacity duration-300 ${sidebarOpen ? "opacity-100" : "opacity-0"}`}>
            <div className="space-y-3 p-4">
              {notes.length === 0 ? (
                <p className="text-sm text-zinc-500">追加された付箋がここに表示されます。</p>
              ) : (
                notes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      selectedId === note.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100"
                    }`}
                    onClick={() => {
                      setSelectedId(note.id);
                      setEditingId(null);
                      setBoardClickPosition(null);
                    }}
                  >
                    <div className="font-semibold text-zinc-900">{note.content || "無題の付箋"}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {`位置: ${note.position.left}px, ${note.position.top}px`}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

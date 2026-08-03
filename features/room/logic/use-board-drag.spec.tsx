import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildNote } from "@/contracts/room-protocol.fixture";
import { useBoardDrag } from "./use-board-drag";

const ME = "11111111-1111-4111-8111-111111111111";

// jsdom は getBoundingClientRect が常に 0 を返すため、rect を持つ疑似要素を
// ref として注入する（hook はビューポートの矩形しか参照しない）。
function fakeElementRef(rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): RefObject<HTMLDivElement | null> {
  return {
    current: {
      getBoundingClientRect: () => rect,
      scrollLeft: 0,
      scrollTop: 0,
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as HTMLDivElement,
  };
}

function pointerEvent(
  pointerId: number,
  clientX: number,
  clientY: number,
): ReactPointerEvent<HTMLDivElement> & ReactPointerEvent<HTMLButtonElement> {
  return { pointerId, clientX, clientY } as ReactPointerEvent<HTMLDivElement> &
    ReactPointerEvent<HTMLButtonElement>;
}

function setup(overrides: Partial<Parameters<typeof useBoardDrag>[0]> = {}) {
  const args = {
    notes: [buildNote({ id: "shared-1", authorId: ME, x: 100, y: 100 })],
    privateNotes: [buildNote({ id: "private-1", authorId: ME, x: 0, y: 0 })],
    currentUserId: ME,
    // ボード: 画面上部の 800x500。ツールバー: 下端の帯。
    boardRootRef: fakeElementRef({ left: 0, top: 0, right: 800, bottom: 600 }),
    boardScrollerRef: fakeElementRef({
      left: 0,
      top: 0,
      right: 800,
      bottom: 500,
    }),
    worldPointFromClient: (clientX: number, clientY: number) => ({
      x: clientX,
      y: clientY,
    }),
    privateToolbarRef: fakeElementRef({
      left: 200,
      top: 540,
      right: 600,
      bottom: 590,
    }),
    onNoteDragStart: vi.fn(),
    onNoteDragMove: vi.fn(),
    onNoteDragEnd: vi.fn(),
    onPrivateNotePublish: vi.fn(),
    onPrivateNoteUnpublish: vi.fn(),
    ...overrides,
  };
  const rendered = renderHook(() => useBoardDrag(args));
  return { args, ...rendered };
}

describe("useBoardDrag", () => {
  it("共有付箋のドラッグ開始で shared 状態になり onNoteDragStart を呼ぶ", () => {
    const { args, result } = setup();

    act(() => {
      result.current.handleSharedNoteDragStart(
        "shared-1",
        pointerEvent(1, 100, 100),
      );
    });

    expect(result.current.drag?.status).toBe("shared");
    expect(args.onNoteDragStart).toHaveBeenCalledWith("shared-1");
  });

  it("マイ付箋をボードへ運ぶと publish → drag 配信の順で共有化する", () => {
    const { args, result } = setup();

    act(() => {
      result.current.handlePrivateDragStart(
        "private-1",
        pointerEvent(1, 400, 560),
      );
    });
    expect(result.current.drag?.status).toBe("private");

    act(() => {
      result.current.handlePointerMove(pointerEvent(1, 300, 200));
    });

    expect(args.onPrivateNotePublish).toHaveBeenCalledWith(
      "private-1",
      300,
      200,
    );
    expect(args.onNoteDragStart).toHaveBeenCalledWith("private-1");
    expect(args.onNoteDragMove).toHaveBeenCalledWith("private-1", 300, 200);
    expect(result.current.drag?.status).toBe("shared");
  });

  it("自分の共有付箋をツールバーへ戻すと unpublish して returning になる", () => {
    const { args, result } = setup();

    act(() => {
      result.current.handleSharedNoteDragStart(
        "shared-1",
        pointerEvent(1, 100, 100),
      );
    });
    act(() => {
      result.current.handlePointerMove(pointerEvent(1, 400, 560));
    });

    expect(args.onPrivateNoteUnpublish).toHaveBeenCalledWith("shared-1");
    expect(result.current.drag?.status).toBe("returning");
    // RoomDO の応答を待たずに、カードを表示上ツールバー側へ移す。
    expect(
      result.current.renderedNotes.some((note) => note.id === "shared-1"),
    ).toBe(false);
    expect(
      result.current.renderedPrivateNotes.some(
        (note) => note.id === "shared-1" && note.visibility === "private",
      ),
    ).toBe(true);
  });

  it("他人の共有付箋はツールバーに重ねても unpublish しない", () => {
    const { args, result } = setup({
      notes: [
        buildNote({ id: "shared-1", authorId: "someone-else", x: 100, y: 100 }),
      ],
    });

    act(() => {
      result.current.handleSharedNoteDragStart(
        "shared-1",
        pointerEvent(1, 100, 100),
      );
    });
    act(() => {
      result.current.handlePointerMove(pointerEvent(1, 400, 560));
    });

    expect(args.onPrivateNoteUnpublish).not.toHaveBeenCalled();
  });

  it("shared 状態でポインターを離すと最終座標で onNoteDragEnd を呼び、状態を解放する", () => {
    const { args, result } = setup();

    act(() => {
      result.current.handleSharedNoteDragStart(
        "shared-1",
        pointerEvent(1, 100, 100),
      );
    });
    act(() => {
      result.current.handlePointerMove(pointerEvent(1, 250, 180));
    });
    act(() => {
      result.current.handlePointerEnd(pointerEvent(1, 250, 180));
    });

    expect(args.onNoteDragEnd).toHaveBeenCalledWith("shared-1", 250, 180);
    expect(result.current.drag).toBeNull();
  });

  it("付箋を掴んだ位置を保ったまま移動・ドロップする", () => {
    const { args, result } = setup();

    act(() => {
      result.current.handleSharedNoteDragStart(
        "shared-1",
        pointerEvent(1, 150, 140),
      );
    });
    act(() => {
      result.current.handlePointerMove(pointerEvent(1, 250, 240));
    });
    act(() => {
      result.current.handlePointerEnd(pointerEvent(1, 250, 240));
    });

    expect(args.onNoteDragMove).toHaveBeenCalledWith("shared-1", 200, 200);
    expect(args.onNoteDragEnd).toHaveBeenCalledWith("shared-1", 200, 200);
  });

  it("異なる pointerId のイベントは無視する（マルチタッチの混線防止）", () => {
    const { args, result } = setup();

    act(() => {
      result.current.handleSharedNoteDragStart(
        "shared-1",
        pointerEvent(1, 100, 100),
      );
    });
    act(() => {
      result.current.handlePointerMove(pointerEvent(2, 300, 200));
    });

    expect(args.onNoteDragMove).not.toHaveBeenCalled();
    expect(result.current.drag?.status).toBe("shared");
  });
});

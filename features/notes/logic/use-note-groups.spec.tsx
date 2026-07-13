// useNoteGroups（永続グループの状態とプロトコル化）の単体テスト。
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNoteGroups } from "./use-note-groups";

// group:updated / snapshot が運ぶワイヤ上のグループ（PersistentGroup +
// createdAt / updatedAt）。
type WireGroup = {
  id: string;
  name: string;
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
};

function group(overrides: Partial<WireGroup> = {}): WireGroup {
  return {
    id: "group-1",
    name: "グループ",
    noteIds: ["note-1", "note-2"],
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("useNoteGroups", () => {
  const send = vi.fn();

  beforeEach(() => {
    send.mockReset();
  });

  function setup() {
    return renderHook(() => useNoteGroups({ send }));
  }

  it("snapshot で groups を復元する（未指定なら空）", () => {
    const { result } = setup();
    act(() =>
      result.current.applyMessage({
        type: "snapshot",
        notes: [],
        members: [],
        phase: "phase1",
        isHost: true,
        timer: { status: "idle" },
        serverNow: Date.now(),
        groups: [group()],
      }),
    );
    expect(result.current.groups).toHaveLength(1);

    act(() =>
      result.current.applyMessage({
        type: "snapshot",
        notes: [],
        members: [],
        phase: "phase1",
        isHost: true,
        timer: { status: "idle" },
        serverNow: Date.now(),
      }),
    );
    expect(result.current.groups).toHaveLength(0);
  });

  it("group:updated は既存を置換し、未知なら追加する", () => {
    const { result } = setup();
    act(() =>
      result.current.applyMessage({
        type: "group:updated",
        group: group({ id: "g1", name: "A" }),
      }),
    );
    act(() =>
      result.current.applyMessage({
        type: "group:updated",
        group: group({ id: "g1", name: "B" }),
      }),
    );
    expect(result.current.groups).toEqual([
      expect.objectContaining({ id: "g1", name: "B" }),
    ]);
  });

  it("group:deleted で該当グループを取り除く", () => {
    const { result } = setup();
    act(() =>
      result.current.applyMessage({
        type: "group:updated",
        group: group({ id: "g1" }),
      }),
    );
    act(() =>
      result.current.applyMessage({ type: "group:deleted", groupId: "g1" }),
    );
    expect(result.current.groups).toHaveLength(0);
  });

  it("createGroup は楽観追加して group:create を送る", () => {
    const { result } = setup();
    act(() => result.current.createGroup("課題A", ["note-1", "note-2"]));

    expect(result.current.groups).toHaveLength(1);
    const created = result.current.groups[0];
    expect(created).toMatchObject({
      name: "課題A",
      noteIds: ["note-1", "note-2"],
    });

    expect(send).toHaveBeenCalledTimes(1);
    const sent = send.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      type: "group:create",
      group: expect.objectContaining({
        id: created?.id,
        name: "課題A",
        noteIds: ["note-1", "note-2"],
      }),
    });
  });

  it("renameGroup は楽観反映して group:update-name を送る", () => {
    const { result } = setup();
    act(() =>
      result.current.applyMessage({
        type: "group:updated",
        group: group({ id: "g1", name: "旧名" }),
      }),
    );

    act(() => result.current.renameGroup("g1", "新名"));

    expect(result.current.groups[0]?.name).toBe("新名");
    expect(send).toHaveBeenCalledWith({
      type: "group:update-name",
      groupId: "g1",
      name: "新名",
    });
  });
});

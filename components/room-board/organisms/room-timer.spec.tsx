import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomTimer } from "./room-timer";

const handlers = {
  onStart: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onExtend: vi.fn(),
  onStop: vi.fn(),
};

describe("RoomTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T10:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it("ホストはプリセットと分:秒入力から開始できる", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "3分" }));
    expect(screen.getByLabelText("タイマー時間（分:秒）")).toHaveValue("03:00");
    fireEvent.change(screen.getByLabelText("タイマー時間（分:秒）"), {
      target: { value: "01:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "開始" }));
    expect(handlers.onStart).toHaveBeenCalledWith(90_000);
  });

  it("非ホストは状態だけを表示し操作UIを出さない", () => {
    render(
      <RoomTimer
        timer={{ status: "paused", remainingMs: 30_000, durationMs: 60_000 }}
        serverOffsetMs={0}
        isHost={false}
        disabled={false}
        {...handlers}
      />,
    );

    expect(screen.getByRole("timer")).toHaveTextContent("00:30");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("タイマー時間（分:秒）"),
    ).not.toBeInTheDocument();
  });

  it("実行中は補正済みサーバー時刻を基準に減り、ホスト操作を送る", () => {
    const now = Date.now();
    render(
      <RoomTimer
        timer={{ status: "running", endsAt: now + 65_000, durationMs: 65_000 }}
        serverOffsetMs={5_000}
        isHost
        disabled={false}
        {...handlers}
      />,
    );

    expect(screen.getByRole("timer")).toHaveTextContent("01:00");
    fireEvent.click(screen.getByRole("button", { name: "一時停止" }));
    fireEvent.click(screen.getByRole("button", { name: "+1分" }));
    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    expect(handlers.onPause).toHaveBeenCalledOnce();
    expect(handlers.onExtend).toHaveBeenCalledOnce();
    expect(handlers.onStop).toHaveBeenCalledOnce();
  });

  it("一時停止中は再開できる", () => {
    render(
      <RoomTimer
        timer={{ status: "paused", remainingMs: 42_000, durationMs: 60_000 }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "再開" }));
    expect(handlers.onResume).toHaveBeenCalledOnce();
  });

  it("00:00 到達時は音を出さず視覚通知する", () => {
    render(
      <RoomTimer
        timer={{ status: "running", endsAt: Date.now(), durationMs: 60_000 }}
        serverOffsetMs={0}
        isHost={false}
        disabled={false}
        {...handlers}
      />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getByTestId("room-timer")).toHaveAttribute(
      "data-ended",
      "true",
    );
  });
});

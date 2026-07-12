import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomTimer } from "./room-timer";
import {
  buildEndedTimer,
  buildPausedTimer,
  buildRunningTimer,
  ROOM_TIMER_FIXTURE_NOW,
} from "./room-timer.fixture";

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
    vi.setSystemTime(ROOM_TIMER_FIXTURE_NOW);
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    "100:00",
    "aa:bb",
    "00:00",
  ])("自由入力 %s は開始できない", (value) => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        {...handlers}
      />,
    );
    const input = screen.getByLabelText("タイマー時間（分:秒）");
    fireEvent.change(input, { target: { value } });

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "開始" })).toBeDisabled();
    expect(handlers.onStart).not.toHaveBeenCalled();
  });

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
        timer={buildPausedTimer({ remainingMs: 30_000, durationMs: 60_000 })}
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

  it("非ホストの未設定状態は --:-- だけを表示する", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost={false}
        disabled={false}
        {...handlers}
      />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("--:--");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("実行中は補正済みサーバー時刻を基準に減り、ホスト操作を送る", () => {
    const now = Date.now();
    render(
      <RoomTimer
        timer={buildRunningTimer({ now, remainingMs: 65_000 })}
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
        timer={buildPausedTimer({ remainingMs: 42_000, durationMs: 60_000 })}
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
        timer={buildEndedTimer({ now: Date.now() })}
        serverOffsetMs={0}
        isHost={false}
        disabled={false}
        {...handlers}
      />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getByRole("timer")).not.toHaveAttribute("aria-live");
    expect(screen.getByText("タイマーが終了しました。")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByTestId("room-timer")).toHaveAttribute(
      "data-ended",
      "true",
    );
  });

  it("時間経過で表示が減り、00:00 到達時に ended になって interval を止める", () => {
    render(
      <RoomTimer
        timer={buildRunningTimer({
          now: Date.now(),
          remainingMs: 60_000,
        })}
        serverOffsetMs={0}
        isHost={false}
        disabled={false}
        {...handlers}
      />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("01:00");

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("timer")).toHaveTextContent("00:59");

    act(() => vi.advanceTimersByTime(59_000));
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getByTestId("room-timer")).toHaveAttribute(
      "data-ended",
      "true",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});

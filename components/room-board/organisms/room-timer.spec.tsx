import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomTimer, TIMER_DEFAULT_DURATION_MS } from "./room-timer";
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

  it("デフォルトのセット時間は定数化された 03:00", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        {...handlers}
      />,
    );
    expect(TIMER_DEFAULT_DURATION_MS).toBe(180_000);
    expect(screen.getByTestId("room-timer")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1分" })).toBeNull();
    expect(screen.queryByRole("button", { name: "3分" })).toBeNull();
    expect(screen.queryByRole("button", { name: "5分" })).toBeNull();
    expect(screen.queryByRole("button", { name: "10分" })).toBeNull();
    expect(screen.getByLabelText("タイマー時間（分）")).toHaveValue("03");
    expect(screen.getByLabelText("タイマー時間（秒）")).toHaveValue("00");
  });

  it("00:00 は開始できない", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        initialDurationMs={0}
        {...handlers}
      />,
    );
    expect(screen.getByLabelText("タイマー時間（分）")).toHaveValue("00");
    expect(screen.getByLabelText("タイマー時間（分）")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("タイマー時間（秒）")).toHaveValue("00");
    expect(screen.getByLabelText("タイマー時間（秒）")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("button", { name: "開始" })).toBeDisabled();
  });

  it("分は99、秒は59を上限に入力値を正規化する", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        {...handlers}
      />,
    );
    fireEvent.change(screen.getByLabelText("タイマー時間（分）"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("タイマー時間（秒）"), {
      target: { value: "60" },
    });
    expect(screen.getByLabelText("タイマー時間（分）")).toHaveValue("99");
    expect(screen.getByLabelText("タイマー時間（秒）")).toHaveValue("59");
  });

  it("ホストは分・秒の自由入力から開始できる", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        {...handlers}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイマー時間（分）"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("タイマー時間（秒）"), {
      target: { value: "30" },
    });
    expect(screen.getByLabelText("タイマー時間（分）")).toHaveValue("01");
    expect(screen.getByLabelText("タイマー時間（秒）")).toHaveValue("30");
    fireEvent.click(screen.getByRole("button", { name: "開始" }));
    expect(handlers.onStart).toHaveBeenCalledWith(90_000);
  });

  it("-1分は 00:00 を下限にクランプする", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        initialDurationMs={60_000}
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "-1分" }));
    fireEvent.click(screen.getByRole("button", { name: "-1分" }));
    expect(screen.getByLabelText("タイマー時間（分）")).toHaveValue("00");
    expect(screen.getByLabelText("タイマー時間（秒）")).toHaveValue("00");
  });

  it("+1分は 99:00 を上限にクランプする", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost
        disabled={false}
        initialDurationMs={98 * 60_000 + 30_000}
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "+1分" }));
    fireEvent.click(screen.getByRole("button", { name: "+1分" }));
    expect(screen.getByLabelText("タイマー時間（分）")).toHaveValue("99");
    expect(screen.getByLabelText("タイマー時間（秒）")).toHaveValue("00");
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
      screen.queryByLabelText("タイマー時間（分）"),
    ).not.toBeInTheDocument();
  });

  it("非ホストの未設定状態はタイマーカード自体を表示しない", () => {
    render(
      <RoomTimer
        timer={{ status: "idle" }}
        serverOffsetMs={0}
        isHost={false}
        disabled={false}
        {...handlers}
      />,
    );
    expect(screen.queryByTestId("room-timer")).not.toBeInTheDocument();
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TIMER_MAX_DURATION_MS,
  type TimerState,
} from "@/contracts/room-protocol";
import { cn } from "@/lib/utils";

const TIMER_PRESETS = [1, 3, 5, 10] as const;

export type RoomTimerProps = {
  timer: TimerState;
  serverOffsetMs: number;
  isHost: boolean;
  disabled: boolean;
  onStart: (durationMs: number) => void;
  onPause: () => void;
  onResume: () => void;
  onExtend: () => void;
  onStop: () => void;
  now?: () => number;
};

const systemNow = (): number => Date.now();

function parseDuration(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) return null;
  const durationMs = (minutes * 60 + seconds) * 1_000;
  if (durationMs < 1 || durationMs > TIMER_MAX_DURATION_MS) return null;
  return durationMs;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, durationMs) / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RoomTimer({
  timer,
  serverOffsetMs,
  isHost,
  disabled,
  onStart,
  onPause,
  onResume,
  onExtend,
  onStop,
  now: getNow = systemNow,
}: RoomTimerProps) {
  const [now, setNow] = useState(() => getNow());
  const [durationInput, setDurationInput] = useState("05:00");

  useEffect(() => {
    if (timer.status !== "running") return;
    const tick = () => {
      const clientNow = getNow();
      setNow(clientNow);
      if (clientNow + serverOffsetMs >= timer.endsAt) {
        window.clearInterval(intervalId);
      }
    };
    const intervalId = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(intervalId);
  }, [getNow, serverOffsetMs, timer]);

  const remainingMs =
    timer.status === "running"
      ? Math.max(0, timer.endsAt - (now + serverOffsetMs))
      : timer.status === "paused"
        ? timer.remainingMs
        : null;
  const isEnded = timer.status === "running" && remainingMs === 0;
  const parsedDuration = useMemo(
    () => parseDuration(durationInput),
    [durationInput],
  );

  return (
    <section
      data-testid="room-timer"
      data-ended={String(isEnded)}
      aria-label="ルーム共有タイマー"
      className={cn(
        "flex min-w-44 flex-col gap-2 rounded-lg border border-border bg-card p-2 shadow-sm",
        isEnded &&
          "animate-pulse border-destructive bg-destructive/15 text-destructive",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          タイマー
        </span>
        <span
          role="timer"
          aria-live="polite"
          className="font-mono text-xl font-bold tabular-nums"
        >
          {remainingMs === null ? "--:--" : formatDuration(remainingMs)}
          <span className="sr-only">
            {isEnded ? "タイマーが終了しました。" : null}
          </span>
        </span>
      </div>

      {isHost && timer.status === "idle" ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {TIMER_PRESETS.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 flex-1 px-1 text-xs"
                disabled={disabled}
                onClick={() =>
                  setDurationInput(`${String(minutes).padStart(2, "0")}:00`)
                }
              >
                {minutes}分
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              aria-label="タイマー時間（分:秒）"
              aria-invalid={parsedDuration === null}
              inputMode="text"
              value={durationInput}
              disabled={disabled}
              className="h-8 w-20 font-mono tabular-nums"
              onChange={(event) => setDurationInput(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 flex-1"
              disabled={disabled || parsedDuration === null}
              onClick={() => {
                if (parsedDuration !== null) onStart(parsedDuration);
              }}
            >
              開始
            </Button>
          </div>
        </div>
      ) : null}

      {isHost && timer.status !== "idle" ? (
        <div className="flex flex-wrap gap-1">
          {timer.status === "paused" ? (
            <Button
              type="button"
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              disabled={disabled}
              onClick={onResume}
            >
              再開
            </Button>
          ) : !isEnded ? (
            <Button
              type="button"
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              disabled={disabled}
              onClick={onPause}
            >
              一時停止
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 px-2 text-xs"
            disabled={disabled}
            onClick={onExtend}
          >
            +1分
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 px-2 text-xs"
            disabled={disabled}
            onClick={onStop}
          >
            停止
          </Button>
        </div>
      ) : null}
    </section>
  );
}

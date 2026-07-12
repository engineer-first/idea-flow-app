"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TIMER_MAX_DURATION_MS,
  type TimerState,
} from "@/contracts/room-protocol";
import { cn } from "@/lib/utils";

export const TIMER_DEFAULT_DURATION_MS = 3 * 60_000;
const TIMER_IDLE_ADJUST_MAX_MS = 99 * 60_000;

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
  initialDurationMs?: number;
  defaultPanelOpen?: boolean;
};

const systemNow = (): number => Date.now();

function parseDuration(minutes: string, seconds: string): number | null {
  const durationMs = (Number(minutes) * 60 + Number(seconds)) * 1_000;
  if (durationMs < 1 || durationMs > TIMER_MAX_DURATION_MS) return null;
  return durationMs;
}

function formatPart(value: number): string {
  return String(value).padStart(2, "0");
}

function fieldsFromDuration(durationMs: number): {
  minutes: string;
  seconds: string;
} {
  const totalSeconds = Math.floor(
    Math.min(Math.max(durationMs, 0), TIMER_MAX_DURATION_MS) / 1_000,
  );
  return {
    minutes: formatPart(Math.floor(totalSeconds / 60)),
    seconds: formatPart(totalSeconds % 60),
  };
}

function normalizePart(value: string, max: number): string {
  const digits = value.replace(/\D/g, "");
  const numeric = digits === "" ? 0 : Number(digits);
  return formatPart(Math.min(numeric, max));
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
  initialDurationMs = TIMER_DEFAULT_DURATION_MS,
  defaultPanelOpen = false,
}: RoomTimerProps) {
  const [now, setNow] = useState(() => getNow());
  const initialFields = fieldsFromDuration(initialDurationMs);
  const [minutesInput, setMinutesInput] = useState(initialFields.minutes);
  const [secondsInput, setSecondsInput] = useState(initialFields.seconds);
  const [panelOpen, setPanelOpen] = useState(defaultPanelOpen);

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
    () => parseDuration(minutesInput, secondsInput),
    [minutesInput, secondsInput],
  );

  const setDuration = (durationMs: number) => {
    const fields = fieldsFromDuration(durationMs);
    setMinutesInput(fields.minutes);
    setSecondsInput(fields.seconds);
  };

  const adjustDuration = (deltaMs: number) => {
    const currentMs =
      (Number(minutesInput) * 60 + Number(secondsInput)) * 1_000;
    setDuration(
      Math.min(Math.max(currentMs + deltaMs, 0), TIMER_IDLE_ADJUST_MAX_MS),
    );
  };

  if (!isHost && timer.status === "idle") return null;

  const chipClassName = cn(
    "h-10 w-28 shrink-0 justify-center rounded-full px-3 shadow-sm",
    "font-mono font-bold tabular-nums",
    timer.status === "paused" &&
      "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    isEnded &&
      "animate-pulse border-destructive bg-destructive/15 text-destructive",
  );
  const chipLabel =
    timer.status === "idle"
      ? "タイマー設定を開く"
      : `タイマー${timer.status === "paused" ? " 一時停止中" : isEnded ? " 終了" : ""} ${formatDuration(remainingMs ?? 0)}${isHost ? "。設定を開く" : ""}`;
  const chipContent = (
    <>
      {timer.status === "idle" ? (
        <span className="font-sans text-sm">タイマー</span>
      ) : (
        <span
          role="timer"
          aria-label={isHost ? undefined : chipLabel}
          className="text-base"
        >
          {formatDuration(remainingMs ?? 0)}
        </span>
      )}
      {timer.status === "paused" ? (
        <span aria-hidden="true" className="ml-1 font-sans text-xs">
          Ⅱ
        </span>
      ) : null}
    </>
  );
  const hostChip = (
    <Button
      type="button"
      data-testid="room-timer"
      data-ended={String(isEnded)}
      data-status={isEnded ? "ended" : timer.status}
      aria-label={chipLabel}
      aria-expanded={panelOpen}
      disabled={disabled}
      variant="outline"
      className={chipClassName}
    >
      {chipContent}
    </Button>
  );
  const memberChip = (
    <span
      data-testid="room-timer"
      data-ended={String(isEnded)}
      data-status={isEnded ? "ended" : timer.status}
      className={cn(
        "inline-flex items-center border border-border bg-background",
        chipClassName,
      )}
    >
      {chipContent}
    </span>
  );

  const panel = (
    <PopoverContent
      data-testid="room-timer-panel"
      aria-label="タイマー設定"
      className="w-72"
    >
      {timer.status === "idle" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">タイマー設定</p>
          <div className="flex items-center justify-between gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={disabled}
              onClick={() => adjustDuration(-60_000)}
            >
              -1分
            </Button>
            <Input
              aria-label="タイマー時間（分）"
              aria-invalid={parsedDuration === null}
              inputMode="numeric"
              maxLength={2}
              value={minutesInput}
              disabled={disabled}
              className="h-8 w-12 px-2 text-center font-mono tabular-nums"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setMinutesInput(normalizePart(event.target.value, 99))
              }
            />
            <span className="font-mono font-bold">:</span>
            <Input
              aria-label="タイマー時間（秒）"
              aria-invalid={parsedDuration === null}
              inputMode="numeric"
              maxLength={2}
              value={secondsInput}
              disabled={disabled}
              className="h-8 w-12 px-2 text-center font-mono tabular-nums"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setSecondsInput(normalizePart(event.target.value, 59))
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={disabled}
              onClick={() => adjustDuration(60_000)}
            >
              +1分
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 w-full"
            disabled={disabled || parsedDuration === null}
            onClick={() => {
              if (parsedDuration !== null) onStart(parsedDuration);
            }}
          >
            開始
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {timer.status === "paused"
                ? "一時停止中"
                : isEnded
                  ? "終了"
                  : "実行中"}
            </p>
            <span className="font-mono text-lg font-bold tabular-nums">
              {formatDuration(remainingMs ?? 0)}
            </span>
          </div>
          <div className="flex gap-2">
            {timer.status === "paused" ? (
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1"
                disabled={disabled}
                onClick={onResume}
              >
                再開
              </Button>
            ) : !isEnded ? (
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1"
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
              className="h-8 flex-1"
              disabled={disabled}
              onClick={onExtend}
            >
              +1分
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 flex-1"
              disabled={disabled}
              onClick={onStop}
            >
              停止
            </Button>
          </div>
        </div>
      )}
    </PopoverContent>
  );

  return (
    <div className="shrink-0">
      {isHost ? (
        <Popover open={panelOpen} onOpenChange={setPanelOpen}>
          <PopoverTrigger asChild>{hostChip}</PopoverTrigger>
          {panel}
        </Popover>
      ) : (
        memberChip
      )}
      <span aria-live="polite" className="sr-only">
        {isEnded ? "タイマーが終了しました。" : null}
      </span>
    </div>
  );
}

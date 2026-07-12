// transitionTimer（純粋関数）の遷移表テスト。
// 認可・永続化・配信を含めた DO 越しの振る舞いは room-protocol.spec.ts が
// 担い、ここでは境界値を含む遷移計算だけを固定する。
import { describe, expect, it } from "vitest";
import {
  TIMER_MAX_DURATION_MS,
  type TimerState,
} from "../../contracts/room-protocol";
import { transitionTimer } from "./timer";

const NOW = 1_720_000_000_000;

const running = (endsAt: number, durationMs: number): TimerState => ({
  status: "running",
  endsAt,
  durationMs,
});

const paused = (remainingMs: number, durationMs: number): TimerState => ({
  status: "paused",
  remainingMs,
  durationMs,
});

describe("transitionTimer: start", () => {
  it("idle から start すると durationMs ぶん先を期限に running になる", () => {
    expect(
      transitionTimer(
        { status: "idle" },
        { kind: "start", durationMs: 300_000 },
        NOW,
      ),
    ).toEqual({
      type: "updated",
      timer: running(NOW + 300_000, 300_000),
    });
  });

  it.each<[string, TimerState]>([
    ["running", running(NOW + 1_000, 60_000)],
    ["paused", paused(1_000, 60_000)],
  ])("%s からの start は invalid（リセットは stop 経由）", (_label, current) => {
    expect(
      transitionTimer(current, { kind: "start", durationMs: 60_000 }, NOW),
    ).toEqual({ type: "invalid" });
  });
});

describe("transitionTimer: pause / resume", () => {
  it("running を pause すると残り時間を保持した paused になる", () => {
    expect(
      transitionTimer(running(NOW + 42_000, 300_000), { kind: "pause" }, NOW),
    ).toEqual({
      type: "updated",
      timer: paused(42_000, 300_000),
    });
  });

  it("期限を過ぎた running の pause は remainingMs を 0 に丸める", () => {
    expect(
      transitionTimer(running(NOW - 1, 300_000), { kind: "pause" }, NOW),
    ).toEqual({
      type: "updated",
      timer: paused(0, 300_000),
    });
  });

  it.each<[string, TimerState]>([
    ["idle", { status: "idle" }],
    ["paused", paused(1_000, 60_000)],
  ])("%s からの pause は invalid", (_label, current) => {
    expect(transitionTimer(current, { kind: "pause" }, NOW)).toEqual({
      type: "invalid",
    });
  });

  it("paused を resume すると残り時間ぶん先を期限に running へ戻る", () => {
    expect(
      transitionTimer(paused(42_000, 300_000), { kind: "resume" }, NOW),
    ).toEqual({
      type: "updated",
      timer: running(NOW + 42_000, 300_000),
    });
  });

  it.each<[string, TimerState]>([
    ["idle", { status: "idle" }],
    ["running", running(NOW + 1_000, 60_000)],
  ])("%s からの resume は invalid", (_label, current) => {
    expect(transitionTimer(current, { kind: "resume" }, NOW)).toEqual({
      type: "invalid",
    });
  });
});

describe("transitionTimer: extend", () => {
  it("running の extend は endsAt と durationMs を 1 分延長する", () => {
    expect(
      transitionTimer(running(NOW + 30_000, 300_000), { kind: "extend" }, NOW),
    ).toEqual({
      type: "updated",
      timer: running(NOW + 30_000 + 60_000, 360_000),
    });
  });

  it("期限切れの running を extend すると「今」を起点に延長する", () => {
    expect(
      transitionTimer(running(NOW - 10_000, 300_000), { kind: "extend" }, NOW),
    ).toEqual({
      type: "updated",
      timer: running(NOW + 60_000, 360_000),
    });
  });

  it("上限との差が 1 分未満なら差分だけ延長する", () => {
    const durationMs = TIMER_MAX_DURATION_MS - 30_000;
    expect(
      transitionTimer(
        running(NOW + 10_000, durationMs),
        { kind: "extend" },
        NOW,
      ),
    ).toEqual({
      type: "updated",
      timer: running(NOW + 10_000 + 30_000, TIMER_MAX_DURATION_MS),
    });
  });

  it("上限に達している running の extend は invalid", () => {
    expect(
      transitionTimer(
        running(NOW + 10_000, TIMER_MAX_DURATION_MS),
        { kind: "extend" },
        NOW,
      ),
    ).toEqual({ type: "invalid" });
  });

  it("paused の extend は remainingMs と durationMs を延長する", () => {
    expect(
      transitionTimer(paused(42_000, 300_000), { kind: "extend" }, NOW),
    ).toEqual({
      type: "updated",
      timer: paused(102_000, 360_000),
    });
  });

  it("上限に達している paused の extend は invalid", () => {
    expect(
      transitionTimer(
        paused(42_000, TIMER_MAX_DURATION_MS),
        { kind: "extend" },
        NOW,
      ),
    ).toEqual({ type: "invalid" });
  });

  it("idle の extend は invalid", () => {
    expect(
      transitionTimer({ status: "idle" }, { kind: "extend" }, NOW),
    ).toEqual({ type: "invalid" });
  });
});

describe("transitionTimer: stop", () => {
  it.each<[string, TimerState]>([
    ["running", running(NOW + 1_000, 60_000)],
    ["paused", paused(1_000, 60_000)],
  ])("%s の stop は idle への更新", (_label, current) => {
    expect(transitionTimer(current, { kind: "stop" }, NOW)).toEqual({
      type: "updated",
      timer: { status: "idle" },
    });
  });

  it("idle の stop はエラーではなく noop", () => {
    expect(transitionTimer({ status: "idle" }, { kind: "stop" }, NOW)).toEqual({
      type: "noop",
    });
  });
});

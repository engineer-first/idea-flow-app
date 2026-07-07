// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSessionSecret, isAuthConfigured } from "@/lib/session/env";

const VALID = "a-sufficiently-long-random-secret-value";
const KNOWN_LEAKED = "dev-session-secret-change-in-production!!";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSessionSecret", () => {
  it("十分な長さの秘密はそのまま返す", () => {
    vi.stubEnv("SESSION_SECRET", VALID);
    expect(getSessionSecret()).toBe(VALID);
  });

  it("未設定は例外", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => getSessionSecret()).toThrow();
  });

  it("短すぎる秘密は例外", () => {
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => getSessionSecret()).toThrow();
  });

  it("git 履歴に漏れた既知の値は例外", () => {
    vi.stubEnv("SESSION_SECRET", KNOWN_LEAKED);
    expect(() => getSessionSecret()).toThrow();
  });
});

describe("isAuthConfigured", () => {
  it("有効な秘密が設定されていれば true", () => {
    vi.stubEnv("SESSION_SECRET", VALID);
    expect(isAuthConfigured()).toBe(true);
  });

  it("既知漏洩値では false（未設定と同じ扱い）", () => {
    vi.stubEnv("SESSION_SECRET", KNOWN_LEAKED);
    expect(isAuthConfigured()).toBe(false);
  });

  it("未設定では false", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(isAuthConfigured()).toBe(false);
  });
});

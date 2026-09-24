import { afterEach, describe, expect, it, vi } from "vitest";
import { localDateKey, todayStr } from "./storage.js";
import { tickCanSendAnything } from "./scheduler.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("local dates (Europe/Ljubljana)", () => {
  it("rolls the day over at local midnight, not UTC midnight (summer)", () => {
    // 22:30 UTC on 1 July is already 00:30 on 2 July in Slovenia (UTC+2).
    expect(localDateKey(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-01T22:30:00Z"));
    expect(todayStr()).toBe("2026-07-02");
  });

  it("rolls the day over at local midnight in winter too (UTC+1)", () => {
    expect(localDateKey(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
    expect(localDateKey(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-15");
  });
});

describe("tickCanSendAnything", () => {
  it.each([
    ["2026-09-24T07:59", false],
    ["2026-09-24T08:05", true],
    ["2026-09-24T08:14", true],
    ["2026-09-24T08:15", false],
    ["2026-09-24T19:07", true],
    ["2026-09-24T19:37", false],
    ["2026-09-24T22:10", true],
    ["2026-09-24T22:30", false],
    ["2026-09-24T23:05", false],
    ["2026-09-24T03:00", false],
  ])("%s -> %s", (localTime, expected) => {
    expect(tickCanSendAnything(new Date(localTime))).toBe(expected);
  });

  it("lets the database sleep for all but 15 ticks a day", () => {
    const ticks = Array.from({ length: 96 }, (_, i) => new Date(2026, 8, 24, 0, i * 15 + 5));
    expect(ticks.filter(tickCanSendAnything)).toHaveLength(15);
  });
});

import { describe, it, expect } from "vitest";
import { isOpenAt } from "./openingHours.js";

// 2026-10-12 is a Monday, 2026-10-11 a Sunday (local time).
const monday10 = new Date(2026, 9, 12, 10, 0);
const monday23 = new Date(2026, 9, 12, 23, 0);
const sunday10 = new Date(2026, 9, 11, 10, 0);

describe("isOpenAt", () => {
  it("reads weekday ranges", () => {
    const tag = "Mo-Fr 08:00-22:00; Sa 09:00-14:00";
    expect(isOpenAt(tag, monday10)).toBe(true);
    expect(isOpenAt(tag, monday23)).toBe(false);
    expect(isOpenAt(tag, sunday10)).toBe(false);
  });

  it("handles ranges past midnight", () => {
    expect(isOpenAt("Mo-Su 18:00-02:00", monday23)).toBe(true);
  });

  it("handles 24/7", () => {
    expect(isOpenAt("24/7", sunday10)).toBe(true);
  });

  it("returns null when there is nothing usable", () => {
    expect(isOpenAt(undefined, monday10)).toBeNull();
    expect(isOpenAt("ask the bartender", monday10)).toBeNull();
  });
});

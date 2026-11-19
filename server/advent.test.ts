import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as advent from "./advent.js";
import * as storage from "./storage.js";
import { createTestCouple, createTestUser, setupDatabase } from "./testUtils.js";
import { sendAdventPoolAlert } from "./email.js";

vi.mock("./email.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./email.js")>()),
  sendAdventPoolAlert: vi.fn(async () => {}),
}));

beforeAll(setupDatabase);

afterEach(() => {
  vi.useRealTimers();
});

function at(date: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${date}T12:00:00`));
}

describe("advent season", () => {
  it("invites from 25 Nov, opens window N on N December, allows catch-up until 31 Dec", () => {
    expect(advent.adventSeason(new Date(2026, 10, 24))).toMatchObject({ phase: "off" });
    expect(advent.adventSeason(new Date(2026, 10, 25))).toMatchObject({ phase: "invite", today: 0 });
    expect(advent.adventSeason(new Date(2026, 11, 1))).toMatchObject({ phase: "active", today: 1 });
    expect(advent.adventSeason(new Date(2026, 11, 24))).toMatchObject({ phase: "active", today: 24 });
    expect(advent.adventSeason(new Date(2026, 11, 28))).toMatchObject({ phase: "catchup", today: 24 });
    expect(advent.adventSeason(new Date(2027, 0, 2))).toMatchObject({ phase: "off" });
  });
});

describe("advent content", () => {
  it("seeds 24 days with four Temptico days, and never overwrites an edited day", async () => {
    const days = await advent.getAdventDays();
    expect(days).toHaveLength(24);
    expect(days.filter((d: { type: string }) => d.type === "temptico").map((d: { day: number }) => d.day)).toEqual([6, 13, 20, 23]);

    await advent.updateAdventDay(1, { title: "Urejeno", text: "Urejeno besedilo" });
    await advent.seedAdventDays();
    const [first] = (await advent.getAdventDays()) as { title: string }[];
    expect(first.title).toBe("Urejeno");
  });

  it("adds UTM parameters to the offer link", () => {
    const url = new URL(advent.withUtm("https://www.temptico.com/hr-hr/collections/all", 13));
    expect(url.searchParams.get("utm_campaign")).toBe("advent");
    expect(url.searchParams.get("utm_content")).toBe("day-13");
  });
});

describe("advent participation", () => {
  it("shows content only to joined couples and only for open windows", async () => {
    at("2026-12-05");
    const { a, b } = await createTestCouple();

    const before = await advent.getAdventState(a, "sl");
    expect(before.joined).toBe(false);
    expect(before.days.every((d: { open: boolean }) => !d.open)).toBe(true);

    await advent.joinAdvent(b); // either partner joining counts for the couple
    const after = await advent.getAdventState(a, "hr");
    expect(after.joined).toBe(true);
    const open = after.days.filter((d: { open: boolean }) => d.open);
    expect(open.map((d: { day: number }) => d.day)).toEqual([1, 2, 3, 4, 5]);
    expect((open[0] as { text: string }).text).toMatch(/sjećanju/); // Croatian
    expect("text" in after.days[5]).toBe(false); // day 6 still locked
  });

  it("counts both partners' days together and hands out exactly one code at the goal", async () => {
    at("2026-12-20");
    const { a, b } = await createTestCouple();
    await advent.joinAdvent(a);
    await advent.addAdventCodes(["TEST-CODE-0001", "TEST-CODE-0002"], 2026);

    for (const day of [1, 2, 3, 4, 5]) await advent.completeAdventDay(a, day);
    for (const day of [5, 6, 7, 8, 9]) await advent.completeAdventDay(b, day); // day 5 done by both
    expect((await advent.getAdventState(a, "sl")).completedCount).toBe(9);
    expect(await advent.ensureAdventReward(a)).toBeNull();

    await advent.completeAdventDay(b, 10);
    const [x, y] = await Promise.all([advent.ensureAdventReward(a), advent.ensureAdventReward(b)]);
    expect([x, y].filter(Boolean)).toHaveLength(1);

    const stateA = await advent.getAdventState(a, "sl");
    const stateB = await advent.getAdventState(b, "sl");
    expect(stateA.reward?.code).toBeTruthy();
    expect(stateB.reward?.code).toBe(stateA.reward?.code);
    expect(await advent.ensureAdventReward(a)).toBeNull(); // no second code
  });

  it("gives a waiting couple its code once codes are added", async () => {
    at("2026-12-22");
    const solo = await createTestUser("Advent");
    await advent.joinAdvent(solo);
    for (let day = 11; day <= 20; day++) await advent.completeAdventDay(solo, day);
    // Pool may be empty here (earlier test took one of two) — drain it.
    while (await advent.ensureAdventReward(await createDrainUser())) {}
    expect(await advent.ensureAdventReward(solo)).toBeNull();
    await advent.addAdventCodes(["TEST-CODE-LATE"], 2026);
    expect(await advent.ensureAdventReward(solo)).toBe("TEST-CODE-LATE");
  });
});

describe("gift code", () => {
  it("shows a day gift code with its note only once the window is open", async () => {
    at("2026-12-13");
    await advent.updateAdventDay(13, { giftCode: "GIFT-TEST", giftNote: "Darilce", giftNoteEn: "Small gift" });
    const u = await createTestUser("Gift");
    await advent.joinAdvent(u);
    const day = (s: Awaited<ReturnType<typeof advent.getAdventState>>, n: number) => s.days.find((d) => d.day === n) as any;
    expect(day(await advent.getAdventState(u, "en"), 13).gift).toEqual({ code: "GIFT-TEST", note: "Small gift" });
    at("2026-12-12");
    expect(day(await advent.getAdventState(u, "sl"), 13).gift).toBeUndefined();
    await advent.updateAdventDay(13, { giftCode: null, giftNote: null, giftNoteEn: null });
  });
});

describe("code pool alert", () => {
  it("warns once when the pool drops below 20 free codes", async () => {
    at("2027-12-20"); // its own year, so its own pool
    const alert = vi.mocked(sendAdventPoolAlert);
    alert.mockClear();
    await advent.addAdventCodes(Array.from({ length: 20 }, (_, i) => `POOL-2027-${String(i).padStart(2, "0")}`), 2027);

    const finisher = async () => {
      const u = await createTestUser("Pool");
      await advent.joinAdvent(u);
      for (let day = 1; day <= 10; day++) await advent.completeAdventDay(u, day);
      return u;
    };
    expect(await advent.ensureAdventReward(await finisher())).toBeTruthy(); // 19 left
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenLastCalledWith(19, false);

    expect(await advent.ensureAdventReward(await finisher())).toBeTruthy(); // 18 left: quiet
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await advent.freeCodeCount(2027)).toBe(18);
  });
});

describe("marketing consent", () => {
  it("is off unless given, and records when it was given", async () => {
    const none = await storage.createUser("Brez", "brez-privolitve@test.local", "sl");
    expect(none.marketingConsent).toBe(false);
    const yes = await storage.createUser("Z", "z-privolitvijo@test.local", "sl", undefined, true);
    expect(yes.marketingConsent).toBe(true);
    expect(yes.marketingConsentAt).toBeTruthy();
  });
});

// A throwaway user who reached the goal, used to use up leftover codes.
let drainCounter = 0;
async function createDrainUser() {
  const u = await createTestUser(`Drain${++drainCounter}`);
  await advent.joinAdvent(u);
  for (let day = 1; day <= 10; day++) await advent.completeAdventDay(u, day);
  return u;
}


import { beforeAll, describe, expect, it } from "vitest";
import { db } from "./db.js";
import { challenges, dailyAssignments } from "../shared/schema.js";
import * as storage from "./storage.js";
import { createTestCouple, setupDatabase } from "./testUtils.js";

beforeAll(setupDatabase);

async function assignOldChallenge(coupleKey: string, date: string) {
  const [challenge] = await db.select().from(challenges).limit(1);
  await db.insert(dailyAssignments).values({ coupleKey, date, type: "challenge", itemId: challenge.id, source: "builtin" });
  return challenge;
}

describe("daily challenge rollover", () => {
  it("keeps serving an unfinished challenge from an earlier day", async () => {
    const { a } = await createTestCouple();
    const old = await assignOldChallenge(storage.coupleKeyFor(a), "2020-01-01");

    const resolved = await storage.resolveDailyChallenge(a, storage.todayStr());
    expect(resolved?.id).toBe(old.id);
    expect(resolved?.date).toBe("2020-01-01");
  });

  it("keeps it for both partners, and rotates for both once either completes it", async () => {
    const { a, b } = await createTestCouple();
    const old = await assignOldChallenge(storage.coupleKeyFor(a), "2020-01-01");
    const today = storage.todayStr();

    expect((await storage.resolveDailyChallenge(b, today))?.id).toBe(old.id);

    await storage.acceptChallenge(b.id, old.id, "2020-01-01");
    await storage.markChallengeCompleted(b.id, old.id, "2020-01-01");

    expect((await storage.resolveDailyChallenge(a, today))?.date).toBe(today);
    expect((await storage.resolveDailyChallenge(b, today))?.date).toBe(today);
  });

  it("an accepted-but-unfinished challenge still rolls over", async () => {
    const { a } = await createTestCouple();
    const old = await assignOldChallenge(storage.coupleKeyFor(a), "2020-01-01");
    await storage.acceptChallenge(a.id, old.id, "2020-01-01");

    expect((await storage.resolveDailyChallenge(a, storage.todayStr()))?.date).toBe("2020-01-01");
  });

  it("counts a late completion toward the streak on the day it was actually done", async () => {
    const { a } = await createTestCouple();
    const old = await assignOldChallenge(storage.coupleKeyFor(a), "2020-01-01");
    await storage.acceptChallenge(a.id, old.id, "2020-01-01");
    await storage.markChallengeCompleted(a.id, old.id, "2020-01-01");

    expect(await storage.calculateStreak(a.id)).toBe(1);
    expect(await storage.hasActivityToday(a.id, storage.todayStr())).toBe(true);
  });
});

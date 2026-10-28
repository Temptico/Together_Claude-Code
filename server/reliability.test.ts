import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { feedback, milestoneEvents, moods, reactions, users } from "../shared/schema.js";
import * as storage from "./storage.js";
import { createTestCouple, createTestUser, setupDatabase } from "./testUtils.js";

beforeAll(setupDatabase);

describe("reminder claims", () => {
  it("hands a reminder to exactly one of two concurrent claimants", async () => {
    const u = await createTestUser("Claim");
    const results = await Promise.all([
      storage.claimReminder(u.id, "2026-10-28", "daily"),
      storage.claimReminder(u.id, "2026-10-28", "daily"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await storage.claimReminder(u.id, "2026-10-28", "daily")).toBe(false);
    expect(await storage.claimReminder(u.id, "2026-10-29", "daily")).toBe(true);
  });
});

describe("one row per user per day", () => {
  it("collapses a double-tapped mood into one row", async () => {
    const u = await createTestUser("Mood");
    const [first, second] = await Promise.all([
      storage.createMood(u.id, 4, undefined, "2026-10-28"),
      storage.createMood(u.id, 2, undefined, "2026-10-28"),
    ]);
    expect(first.id).toBe(second.id);
    const rows = await db.select().from(moods).where(eq(moods.userId, u.id));
    expect(rows).toHaveLength(1);
  });

  it("keeps the first answer and the first challenge acceptance", async () => {
    const u = await createTestUser("Dup");
    const a1 = await storage.createAnswer(u.id, 1, "prvi", "2026-10-28");
    const a2 = await storage.createAnswer(u.id, 1, "drugi", "2026-10-28");
    expect(a2.id).toBe(a1.id);
    expect(a2.answer).toBe("prvi");

    const c1 = await storage.acceptChallenge(u.id, 1, "2026-10-28");
    const c2 = await storage.acceptChallenge(u.id, 1, "2026-10-28");
    expect(c2.id).toBe(c1.id);
  });
});

describe("push subscriptions", () => {
  it("re-binds a device endpoint to whoever logs in next", async () => {
    const a = await createTestUser("PushA");
    const b = await createTestUser("PushB");
    await storage.savePushSubscription(a.id, "https://push.example/dev-1", "k1", "a1");
    await storage.savePushSubscription(b.id, "https://push.example/dev-1", "k2", "a2");
    expect(await storage.getPushSubscriptionsForUser(a.id)).toHaveLength(0);
    const forB = await storage.getPushSubscriptionsForUser(b.id);
    expect(forB).toHaveLength(1);
    expect(forB[0].p256dh).toBe("k2");
  });

  it("drops an endpoint the push service reported gone", async () => {
    const u = await createTestUser("PushGone");
    await storage.savePushSubscription(u.id, "https://push.example/dead", "k", "a");
    await storage.deletePushSubscriptionByEndpoint("https://push.example/dead");
    expect(await storage.getPushSubscriptionsForUser(u.id)).toHaveLength(0);
  });
});

describe("account deletion", () => {
  it("erases the user's rows, the partner's reactions on them, and unlinks the partner", async () => {
    const { a, b } = await createTestCouple();
    const mood = await storage.createMood(a.id, 5, "super", "2026-10-28");
    await storage.toggleReaction(b.id, "mood", mood.id, "❤️");
    await storage.createFeedback(a.id, "suggestion", "več iger");
    await db.insert(milestoneEvents).values({ userId: a.id, type: "streak_7", value: 7 });

    await storage.deleteUserAccount((await storage.getUserById(a.id))!);

    expect(await storage.getUserById(a.id)).toBeUndefined();
    expect((await storage.getUserById(b.id))?.partnerId).toBeNull();
    expect(await db.select().from(moods).where(eq(moods.userId, a.id))).toHaveLength(0);
    expect(await db.select().from(reactions).where(eq(reactions.targetId, mood.id))).toHaveLength(0);
    expect(await db.select().from(feedback).where(eq(feedback.userId, a.id))).toHaveLength(0);
    expect(await db.select().from(milestoneEvents).where(eq(milestoneEvents.userId, a.id))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, b.id))).toHaveLength(1);
  });
});

describe("streak", () => {
  it("counts past 60 days", async () => {
    const u = await createTestUser("Streak");
    const today = new Date();
    for (let i = 0; i < 70; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      await storage.createMood(u.id, 3, undefined, storage.localDateKey(d));
    }
    expect(await storage.calculateStreak(u.id)).toBe(70);
  });
});

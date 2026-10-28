import { beforeAll, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { db } from "./db.js";
import { challenges, dateIdeas, gamePrompts, questions } from "../shared/schema.js";
import { runSeed } from "./seed.js";
import * as storage from "./storage.js";
import { setupDatabase } from "./testUtils.js";

beforeAll(setupDatabase);

describe("seeding", () => {
  it("is idempotent: a second run changes nothing", async () => {
    const before = await Promise.all([
      db.select().from(questions),
      db.select().from(challenges),
      db.select().from(dateIdeas),
      db.select().from(gamePrompts),
    ]);
    await runSeed();
    const after = await Promise.all([
      db.select().from(questions),
      db.select().from(challenges),
      db.select().from(dateIdeas),
      db.select().from(gamePrompts),
    ]);
    expect(after.map((r) => r.length)).toEqual(before.map((r) => r.length));
  });

  it("gives every seeded row a key, and no two rows the same text", async () => {
    const unkeyed = await db.select().from(questions).where(isNull(questions.seedKey));
    expect(unkeyed).toHaveLength(0);
    const all = await db.select().from(questions);
    expect(new Set(all.map((q: { text: string }) => q.text)).size).toBe(all.length);
  });

  it("updates a row in place when its text changes, and re-keys legacy rows by text", async () => {
    // Simulate a database from before keys existed: strip the key and
    // introduce a typo on one row, as if the old seed had inserted it.
    const [q] = await db.select().from(questions).where(eq(questions.seedKey, "q001"));
    await db.update(questions).set({ seedKey: null, text: q.text + " (star zapis)" }).where(eq(questions.id, q.id));
    // The typo'd legacy row no longer matches anything: it's deactivated and
    // the correct text is inserted under its key.
    await runSeed();
    const [fixed] = await db.select().from(questions).where(eq(questions.seedKey, "q001"));
    expect(fixed.text).toBe(q.text);
    const [legacy] = await db.select().from(questions).where(eq(questions.id, q.id));
    expect(legacy.active).toBe(false);
    expect((await storage.getAllQuestions()).some((row: { id: number }) => row.id === q.id)).toBe(false);

    // Clean up: restore the original row so later tests see one copy.
    await db.delete(questions).where(eq(questions.id, fixed.id));
    await db.update(questions).set({ seedKey: "q001", text: q.text, active: true }).where(eq(questions.id, q.id));
  });

  it("leaves custom date ideas alone", async () => {
    const [custom] = await db
      .insert(dateIdeas)
      .values({ title: "Najin skrivni zmenek", description: "samo za naju", category: "doma", cost: "eur", duration: "1h", custom: true })
      .returning();
    await runSeed();
    const [after] = await db.select().from(dateIdeas).where(eq(dateIdeas.id, custom.id));
    expect(after.seedKey).toBeNull();
    expect(after.description).toBe("samo za naju");
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { gameRoundAnswers } from "../shared/schema.js";
import * as storage from "./storage.js";
import { createTestCouple, setupDatabase } from "./testUtils.js";

beforeAll(setupDatabase);

describe("disconnecting partners", () => {
  it("unlinks both sides and regenerates both connect codes", async () => {
    const { a, b } = await createTestCouple();
    await storage.disconnectPartner(a);

    const [a2, b2] = await Promise.all([storage.getUserById(a.id), storage.getUserById(b.id)]);
    expect(a2?.partnerId).toBeNull();
    expect(b2?.partnerId).toBeNull();
    expect(a2?.connectCode).not.toBe(a.connectCode);
    expect(b2?.connectCode).not.toBe(b.connectCode);
  });

  it("stops an ex from re-linking with the code they already knew", async () => {
    const { a, b } = await createTestCouple();
    await storage.disconnectPartner(b);

    const result = await storage.connectPartner(b.id, a.connectCode);
    expect(result.ok).toBe(false);
  });

  it("brings shared content back if the same two people reconnect", async () => {
    const { a, b } = await createTestCouple();
    const { round } = (await storage.getOrCreateGameRound(a, "this-or-that"))!;
    await storage.disconnectPartner(a);

    const aNow = (await storage.getUserById(a.id))!;
    expect(await storage.getGameRoundForUser(aNow, round.id)).toBeUndefined();

    const reconnect = await storage.connectPartner(b.id, aNow.connectCode);
    expect(reconnect.ok).toBe(true);
    const aAgain = (await storage.getUserById(a.id))!;
    expect((await storage.getGameRoundForUser(aAgain, round.id))?.id).toBe(round.id);
  });
});

describe("deleting an account", () => {
  it("removes the user's game answers", async () => {
    const { a } = await createTestCouple();
    const { round } = (await storage.getOrCreateGameRound(a, "this-or-that"))!;
    await storage.submitGameRoundAnswer(round.id, a.id, JSON.parse(round.promptIds)[0], "A");

    await storage.deleteUserAccount(a);
    const left = await db.select().from(gameRoundAnswers).where(eq(gameRoundAnswers.userId, a.id));
    expect(left).toEqual([]);
  });
});

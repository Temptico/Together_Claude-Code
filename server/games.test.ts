import { beforeAll, describe, expect, it } from "vitest";
import * as storage from "./storage.js";
import type { User } from "../shared/schema.js";
import { createTestCouple, setupDatabase } from "./testUtils.js";

beforeAll(setupDatabase);

// Answers every prompt of a round for both partners; `bAnswer` decides
// partner B's answer per prompt index so tests control how many match.
async function finishRound(roundId: number, promptIds: number[], a: User, b: User, bAnswer: (i: number) => string) {
  for (const [i, pid] of promptIds.entries()) {
    await storage.submitGameRoundAnswer(roundId, a.id, pid, "A");
    await storage.submitGameRoundAnswer(roundId, b.id, pid, bAnswer(i));
  }
}

describe("game rounds", () => {
  it("creates a deck once and resumes it after", async () => {
    const { a, b } = await createTestCouple();
    const first = await storage.getOrCreateGameRound(a, "this-or-that");
    const again = await storage.getOrCreateGameRound(b, "this-or-that");

    expect(first?.isNew).toBe(true);
    expect(again?.isNew).toBe(false);
    expect(again?.round.id).toBe(first?.round.id);
    expect(JSON.parse(first!.round.promptIds)).toHaveLength(15);
  });

  it("keeps showing a finished round until someone starts a new one", async () => {
    const { a, b } = await createTestCouple();
    const { round } = (await storage.getOrCreateGameRound(a, "this-or-that"))!;
    await finishRound(round.id, JSON.parse(round.promptIds), a, b, () => "A");

    // The partner opening the game from "see your results" must land on the results.
    const reopened = await storage.getOrCreateGameRound(b, "this-or-that");
    expect(reopened?.round.id).toBe(round.id);
    expect(reopened?.isNew).toBe(false);

    const fresh = await storage.getOrCreateGameRound(a, "this-or-that", true);
    expect(fresh?.isNew).toBe(true);
    expect(fresh?.round.id).not.toBe(round.id);
  });

  it("'play again' on an unfinished deck resumes it instead of starting another", async () => {
    const { a } = await createTestCouple();
    const first = await storage.getOrCreateGameRound(a, "would-you-rather");
    const again = await storage.getOrCreateGameRound(a, "would-you-rather", true);
    expect(again?.round.id).toBe(first?.round.id);
  });

  it("lists finished rounds for Memories with how many answers matched", async () => {
    const { a, b } = await createTestCouple();
    const { round } = (await storage.getOrCreateGameRound(a, "this-or-that"))!;
    // B differs on every third prompt: 5 of 15 differ, 10 match.
    await finishRound(round.id, JSON.parse(round.promptIds), a, b, (i) => (i % 3 === 2 ? "B" : "A"));

    const completed = await storage.getCompletedGameRounds(a);
    expect(completed).toEqual([expect.objectContaining({ roundId: round.id, total: 15, matches: 10 })]);
  });

  it("does not list a round until both partners have answered everything", async () => {
    const { a } = await createTestCouple();
    const { round } = (await storage.getOrCreateGameRound(a, "this-or-that"))!;
    await storage.submitGameRoundAnswer(round.id, a.id, JSON.parse(round.promptIds)[0], "A");
    expect(await storage.getCompletedGameRounds(a)).toEqual([]);
  });

  it("only lets the couple who played a round reopen it", async () => {
    const couple = await createTestCouple();
    const stranger = await createTestCouple();
    const { round } = (await storage.getOrCreateGameRound(couple.a, "this-or-that"))!;

    expect((await storage.getGameRoundForUser(couple.b, round.id))?.id).toBe(round.id);
    expect(await storage.getGameRoundForUser(stranger.a, round.id)).toBeUndefined();
  });
});

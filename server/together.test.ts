import { beforeAll, describe, expect, it, vi } from "vitest";
import * as storage from "./storage.js";
import { createTestCouple, createTestUser, setupDatabase } from "./testUtils.js";
import {
  QUIZ_LENGTH,
  QUIZ_QUESTIONS,
  coupleResult,
  isValidQuizAnswers,
  personalType,
  type CoupleType,
} from "../shared/coupleQuiz.js";

beforeAll(setupDatabase);

// The option index of the given type in each question.
function answersFor(type: CoupleType): number[] {
  return QUIZ_QUESTIONS.map((q) => q.options.findIndex((o) => o.type === type));
}

describe("couple quiz scoring", () => {
  it("has every type exactly once per question, in all three languages", () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(new Set(q.options.map((o) => o.type)).size).toBe(4);
      for (const o of q.options) expect(o.text.sl && o.text.en && o.text.hr).toBeTruthy();
    }
  });

  it("matches 100 % with identical answers and lands on their shared type", () => {
    const cozy = answersFor("cozy");
    expect(personalType(cozy)).toBe("cozy");
    expect(coupleResult(cozy, cozy)).toMatchObject({ type: "cozy", match: 100 });
  });

  it("scores close types higher than opposite ones", () => {
    const near = coupleResult(answersFor("adventure"), answersFor("playful")).match;
    const far = coupleResult(answersFor("adventure"), answersFor("cozy")).match;
    expect(near).toBe(60);
    expect(far).toBe(30);
  });

  it("rejects malformed answers", () => {
    expect(isValidQuizAnswers(answersFor("deep"))).toBe(true);
    expect(isValidQuizAnswers([0, 1])).toBe(false);
    expect(isValidQuizAnswers(Array(QUIZ_LENGTH).fill(4))).toBe(false);
    expect(isValidQuizAnswers("0,1,2")).toBe(false);
  });

  it("stores answers once and treats a second save as a retake", async () => {
    const user = await createTestUser("Quiz");
    expect(await storage.getQuizAnswers(user.id)).toBeNull();
    expect(await storage.saveQuizAnswers(user.id, answersFor("deep"))).toEqual({ first: true });
    expect(await storage.saveQuizAnswers(user.id, answersFor("cozy"))).toEqual({ first: false });
    expect(await storage.getQuizAnswers(user.id)).toEqual(answersFor("cozy"));
  });
});

describe("thinking of you", () => {
  it("counts today's hearts both ways and pushes a burst only once", async () => {
    const { a, b } = await createTestCouple();
    expect(await storage.sendLoveTap(a)).toEqual({ push: true });
    expect(await storage.sendLoveTap(a)).toEqual({ push: false });
    await storage.sendLoveTap(b);

    const forA = await storage.getLoveTapSummary(a);
    expect(forA).toMatchObject({ sentToday: 2, receivedToday: 1 });
    expect(forA!.lastReceived).not.toBeNull();
    const forB = await storage.getLoveTapSummary(b);
    expect(forB).toMatchObject({ sentToday: 1, receivedToday: 2 });

    // A minute later the next tap notifies again.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + storage.LOVE_TAP_PUSH_GAP_MS + 1000);
    expect(await storage.sendLoveTap(a)).toEqual({ push: true });
    vi.useRealTimers();
  });

  it("has nothing to show without a partner", async () => {
    const solo = await createTestUser("Solo");
    expect(await storage.getLoveTapSummary(solo)).toBeNull();
  });
});

describe("bucket list", () => {
  it("records who ticked an item off and when, and lists it for both partners", async () => {
    const { a, b } = await createTestCouple();
    const item = await storage.createWishlistItem(a, "Let z balonom 🎈");
    const done = await storage.updateWishlistItem(item.id, b, { completed: true });
    expect(done).toMatchObject({ completed: true, completedBy: b.id });
    expect(done!.completedAt).toBeInstanceOf(Date);

    const withPhoto = await storage.updateWishlistItem(item.id, a, { photo: "data:image/jpeg;base64,AAAA" });
    expect(withPhoto).toMatchObject({ completed: true, photo: "data:image/jpeg;base64,AAAA" });

    expect((await storage.getCompletedWishlist(a, 10)).map((i: { id: number }) => i.id)).toEqual([item.id]);
    expect((await storage.getCompletedWishlist(b, 10)).map((i: { id: number }) => i.id)).toEqual([item.id]);

    const undone = await storage.updateWishlistItem(item.id, a, { completed: false });
    expect(undone).toMatchObject({ completed: false, completedBy: null, completedAt: null });
  });

  it("keeps another couple's items out of reach", async () => {
    const one = await createTestCouple();
    const other = await createTestCouple();
    const item = await storage.createWishlistItem(one.a, "Piknik pod zvezdami");
    expect(await storage.updateWishlistItem(item.id, other.a, { completed: true })).toBeUndefined();
    expect(await storage.deleteWishlistItem(item.id, other.b)).toBeUndefined();
    expect(await storage.getWishlistItem(item.id, one.b)).toBeTruthy();
  });

  it("removes a deleted account's taps and quiz answers", async () => {
    const { a, b } = await createTestCouple();
    await storage.sendLoveTap(a);
    await storage.saveQuizAnswers(a.id, answersFor("playful"));
    await storage.deleteUserAccount(a);
    expect(await storage.getQuizAnswers(a.id)).toBeNull();
    const fresh = await storage.getUserById(b.id);
    expect(await storage.getLoveTapSummary({ ...fresh!, partnerId: a.id })).toMatchObject({ sentToday: 0, receivedToday: 0 });
  });
});

describe("love jar", () => {
  it("lets the partner draw one random note a day and keeps exes out", async () => {
    const { a, b } = await createTestCouple();
    await storage.addLoveNote(a, "Rad te imam, ker se smejiš");
    await storage.addLoveNote(a, "Hvala za kavo");
    expect(await storage.getLoveJar(b)).toMatchObject({ waiting: 2, today: null });
    expect(await storage.getLoveJar(a)).toMatchObject({ waiting: 0, mineWaiting: 2 });

    expect(await storage.drawLoveNote(b)).toBe("drawn");
    expect(await storage.drawLoveNote(b)).toBe("already");
    const jar = await storage.getLoveJar(b);
    expect(jar).toMatchObject({ waiting: 1 });
    expect(jar!.today).not.toBeNull();
    expect(jar!.drawn).toHaveLength(1);

    // A drawn note can't be taken back; one still in the jar can.
    const mine = (await storage.getLoveJar(a))!.mine;
    const read = mine.find((n) => n.drawnAt)!;
    const unread = mine.find((n) => !n.drawnAt)!;
    expect(await storage.deleteLoveNote(a, read.id)).toBe(false);
    expect(await storage.deleteLoveNote(b, unread.id)).toBe(false);
    expect(await storage.deleteLoveNote(a, unread.id)).toBe(true);
    expect(await storage.getLoveJar(b)).toMatchObject({ waiting: 0 });

    await storage.disconnectPartner(a);
    const solo = (await storage.getUserById(b.id))!;
    expect(await storage.getLoveJar(solo)).toBeNull();
  });

  it("draws nothing from an empty jar", async () => {
    const { b } = await createTestCouple();
    expect(await storage.drawLoveNote(b)).toBe("empty");
  });
});

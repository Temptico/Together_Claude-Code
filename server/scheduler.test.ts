import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./push.js", () => ({ notifyUser: vi.fn(async () => {}) }));

import { notifyUser } from "./push.js";
import * as storage from "./storage.js";
import { tick } from "./scheduler.js";
import { joinAdvent } from "./advent.js";
import { createTestCouple, setupDatabase } from "./testUtils.js";

type PayloadBuilder = (lang: string) => { title: string; body: string; tag?: string };

beforeAll(setupDatabase);

beforeEach(() => {
  vi.mocked(notifyUser).mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

// Other reminders (e.g. the daily check-in) can fire on the same tick, so
// assertions pick out one reminder type by its tag.
function sentWithTag(tagPrefix: string) {
  return vi
    .mocked(notifyUser)
    .mock.calls.map(([userId, build]) => ({ userId, ...(build as PayloadBuilder)("sl") }))
    .filter((n) => n.tag?.startsWith(tagPrefix));
}

async function tickAt(localTime: string) {
  vi.setSystemTime(new Date(localTime));
  await tick();
}

describe("birthday reminders", () => {
  it("tells the partner 14 days before and on the day, and greets the birthday person", async () => {
    const { a, b } = await createTestCouple();
    await storage.updateUser(a.id, { birthday: "1994-10-08" });

    await tickAt("2026-09-24T09:05");
    expect(sentWithTag("partner_birthday")).toEqual([
      expect.objectContaining({ userId: b.id, tag: "partner_birthday_14d", body: expect.stringContaining(a.name) }),
    ]);

    vi.mocked(notifyUser).mockClear();
    await tickAt("2026-10-08T09:05");
    expect(sentWithTag("partner_birthday")).toEqual([expect.objectContaining({ userId: b.id, tag: "partner_birthday_0d" })]);
    expect(sentWithTag("own-birthday")).toEqual([expect.objectContaining({ userId: a.id })]);
  });

  it("sends each reminder only once per day", async () => {
    const { a } = await createTestCouple();
    await storage.updateUser(a.id, { birthday: "1990-11-20" });

    await tickAt("2026-11-06T09:02");
    await tickAt("2026-11-06T09:11");
    expect(sentWithTag("partner_birthday_14d")).toHaveLength(1);
  });
});

describe("quiet hours", () => {
  it("sends nothing outside the reminder window", async () => {
    const { a } = await createTestCouple();
    await storage.updateUser(a.id, { birthday: "1994-10-08" });

    await tickAt("2026-10-08T03:00");
    await tickAt("2026-10-08T09:40");
    expect(notifyUser).not.toHaveBeenCalled();
  });
});

describe("advent reminder", () => {
  it("nudges both partners of a couple that joined at 19:00 in December, and nobody else", async () => {
    const { a, b } = await createTestCouple();
    const outsider = (await createTestCouple()).a;
    vi.setSystemTime(new Date("2026-12-03T10:00:00"));
    await joinAdvent(a);

    await tickAt("2026-12-03T19:05:00");
    const sent = sentWithTag("advent").map((n) => n.userId);
    expect(sent).toContain(a.id);
    expect(sent).toContain(b.id);
    expect(sent).not.toContain(outsider.id);

    // Not twice the same evening.
    vi.mocked(notifyUser).mockClear();
    await tickAt("2026-12-03T19:10:00");
    expect(sentWithTag("advent")).toHaveLength(0);
  });

  it("stays quiet outside 1–24 December", async () => {
    const { a } = await createTestCouple();
    vi.setSystemTime(new Date("2026-11-28T10:00:00"));
    await joinAdvent(a);
    await tickAt("2026-11-28T19:05:00");
    expect(sentWithTag("advent")).toHaveLength(0);
  });
});

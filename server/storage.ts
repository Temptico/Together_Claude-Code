import { eq, and, or, desc, gte, asc } from "drizzle-orm";
import { db } from "./db.js";
import {
  users,
  moods,
  questions,
  questionAnswers,
  challenges,
  challengeCompletions,
  dateIdeas,
  plannedDates,
  pushSubscriptions,
  reactions,
  customQuestions,
  customChallenges,
  dailyAssignments,
  reminderLog,
  type User,
} from "../shared/schema.js";
import { customAlphabet } from "nanoid";

const idGen = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 20);
const codeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(dateStr: string): number {
  // Stable integer derived from a YYYY-MM-DD string, used to deterministically
  // pick "today's" question/challenge so both partners see the same one.
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function coupleKeyFor(user: User): string {
  return user.partnerId ? [user.id, user.partnerId].sort().join("_") : user.id;
}

// ---------------- Users ----------------
export async function createUser(name: string, email: string): Promise<User> {
  let connectCode = codeGen();
  // extremely unlikely collision, but guard anyway
  while (await getUserByConnectCode(connectCode)) connectCode = codeGen();
  const [user] = await db
    .insert(users)
    .values({ id: idGen(), name, email, connectCode })
    .returning();
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByConnectCode(code: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.connectCode, code));
  return user;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User> {
  const [user] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return user;
}

export async function connectPartner(
  userId: string,
  code: string
): Promise<{ ok: true; partner: User } | { ok: false; error: string }> {
  const me = await getUserById(userId);
  if (!me) return { ok: false, error: "Uporabnik ne obstaja" };
  if (me.partnerId) return { ok: false, error: "Že imaš povezanega partnerja" };

  const target = await getUserByConnectCode(code.toUpperCase());
  if (!target) return { ok: false, error: "Koda ne obstaja" };
  if (target.id === userId) return { ok: false, error: "Ne moreš se povezati sam s seboj" };
  if (target.partnerId) return { ok: false, error: "Ta uporabnik je že povezan z nekom drugim" };

  await db.update(users).set({ partnerId: target.id }).where(eq(users.id, userId));
  await db.update(users).set({ partnerId: userId }).where(eq(users.id, target.id));

  const partner = await getUserById(target.id);
  return { ok: true, partner: partner! };
}

// ---------------- Moods ----------------
export async function getMoodForDate(userId: string, date: string) {
  const [mood] = await db
    .select()
    .from(moods)
    .where(and(eq(moods.userId, userId), eq(moods.date, date)));
  return mood;
}

export async function createMood(userId: string, level: number, note: string | undefined, date: string) {
  const existing = await getMoodForDate(userId, date);
  if (existing) return existing;
  const [mood] = await db.insert(moods).values({ userId, level, note, date }).returning();
  return mood;
}

export async function getRecentMoods(userId: string, limit = 30) {
  return db.select().from(moods).where(eq(moods.userId, userId)).orderBy(desc(moods.date)).limit(limit);
}

// ---------------- Questions ----------------
export async function getAllQuestions() {
  return db.select().from(questions);
}

async function getBuiltinQuestionOfTheDay(date: string, coupleKey: string) {
  const all = await getAllQuestions();
  if (all.length === 0) return undefined;
  return all[dayIndex(date + coupleKey) % all.length];
}

export type ResolvedQuestion = { id: number; text: string; category: string; isCustom: boolean };

export async function resolveDailyQuestion(user: User, date: string): Promise<ResolvedQuestion | undefined> {
  const coupleKey = coupleKeyFor(user);

  const [existingAssignment] = await db
    .select()
    .from(dailyAssignments)
    .where(
      and(eq(dailyAssignments.coupleKey, coupleKey), eq(dailyAssignments.date, date), eq(dailyAssignments.type, "question"))
    );

  if (existingAssignment) {
    if (existingAssignment.source === "custom") {
      const [custom] = await db.select().from(customQuestions).where(eq(customQuestions.id, existingAssignment.itemId));
      if (custom) return { id: custom.id, text: custom.text, category: "lastno", isCustom: true };
    } else {
      const [builtin] = await db.select().from(questions).where(eq(questions.id, existingAssignment.itemId));
      if (builtin) return { id: builtin.id, text: builtin.text, category: builtin.category, isCustom: false };
    }
  }

  const [pendingCustom] = await db
    .select()
    .from(customQuestions)
    .where(and(eq(customQuestions.coupleKey, coupleKey), eq(customQuestions.used, false)))
    .orderBy(asc(customQuestions.createdAt))
    .limit(1);

  if (pendingCustom) {
    await db.update(customQuestions).set({ used: true, usedDate: date }).where(eq(customQuestions.id, pendingCustom.id));
    await db
      .insert(dailyAssignments)
      .values({ coupleKey, date, type: "question", itemId: pendingCustom.id, source: "custom" })
      .onConflictDoNothing();
    return { id: pendingCustom.id, text: pendingCustom.text, category: "lastno", isCustom: true };
  }

  const builtin = await getBuiltinQuestionOfTheDay(date, coupleKey);
  if (!builtin) return undefined;
  await db
    .insert(dailyAssignments)
    .values({ coupleKey, date, type: "question", itemId: builtin.id, source: "builtin" })
    .onConflictDoNothing();
  return { id: builtin.id, text: builtin.text, category: builtin.category, isCustom: false };
}

export async function getAnswerForDate(userId: string, questionId: number, date: string) {
  const [answer] = await db
    .select()
    .from(questionAnswers)
    .where(
      and(
        eq(questionAnswers.userId, userId),
        eq(questionAnswers.questionId, questionId),
        eq(questionAnswers.date, date)
      )
    );
  return answer;
}

export async function createAnswer(
  userId: string,
  questionId: number,
  answer: string,
  date: string,
  source: "builtin" | "custom" = "builtin"
) {
  const existing = await getAnswerForDate(userId, questionId, date);
  if (existing) return existing;
  const [row] = await db.insert(questionAnswers).values({ userId, questionId, answer, date, source }).returning();
  return row;
}

export async function getRecentAnswers(userId: string, limit = 30) {
  return db
    .select()
    .from(questionAnswers)
    .where(eq(questionAnswers.userId, userId))
    .orderBy(desc(questionAnswers.date))
    .limit(limit);
}

// ---------------- Challenges ----------------
export async function getActiveChallenges() {
  return db.select().from(challenges).where(eq(challenges.active, true));
}

async function getBuiltinChallengeOfTheDay(date: string, coupleKey: string) {
  const all = await getActiveChallenges();
  if (all.length === 0) return undefined;
  return all[dayIndex(date + coupleKey) % all.length];
}

export type ResolvedChallenge = { id: number; text: string; category: string; difficulty: string; isCustom: boolean };

export async function resolveDailyChallenge(user: User, date: string): Promise<ResolvedChallenge | undefined> {
  const coupleKey = coupleKeyFor(user);

  const [existingAssignment] = await db
    .select()
    .from(dailyAssignments)
    .where(
      and(eq(dailyAssignments.coupleKey, coupleKey), eq(dailyAssignments.date, date), eq(dailyAssignments.type, "challenge"))
    );

  if (existingAssignment) {
    if (existingAssignment.source === "custom") {
      const [custom] = await db.select().from(customChallenges).where(eq(customChallenges.id, existingAssignment.itemId));
      if (custom) return { id: custom.id, text: custom.text, category: "lastno", difficulty: "easy", isCustom: true };
    } else {
      const [builtin] = await db.select().from(challenges).where(eq(challenges.id, existingAssignment.itemId));
      if (builtin)
        return { id: builtin.id, text: builtin.text, category: builtin.category, difficulty: builtin.difficulty, isCustom: false };
    }
  }

  const [pendingCustom] = await db
    .select()
    .from(customChallenges)
    .where(and(eq(customChallenges.coupleKey, coupleKey), eq(customChallenges.used, false)))
    .orderBy(asc(customChallenges.createdAt))
    .limit(1);

  if (pendingCustom) {
    await db
      .update(customChallenges)
      .set({ used: true, usedDate: date })
      .where(eq(customChallenges.id, pendingCustom.id));
    await db
      .insert(dailyAssignments)
      .values({ coupleKey, date, type: "challenge", itemId: pendingCustom.id, source: "custom" })
      .onConflictDoNothing();
    return { id: pendingCustom.id, text: pendingCustom.text, category: "lastno", difficulty: "easy", isCustom: true };
  }

  const builtin = await getBuiltinChallengeOfTheDay(date, coupleKey);
  if (!builtin) return undefined;
  await db
    .insert(dailyAssignments)
    .values({ coupleKey, date, type: "challenge", itemId: builtin.id, source: "builtin" })
    .onConflictDoNothing();
  return { id: builtin.id, text: builtin.text, category: builtin.category, difficulty: builtin.difficulty, isCustom: false };
}

export async function getCompletionForDate(userId: string, challengeId: number, date: string) {
  const [row] = await db
    .select()
    .from(challengeCompletions)
    .where(
      and(
        eq(challengeCompletions.userId, userId),
        eq(challengeCompletions.challengeId, challengeId),
        eq(challengeCompletions.date, date)
      )
    );
  return row;
}

export async function completeChallenge(
  userId: string,
  challengeId: number,
  date: string,
  source: "builtin" | "custom" = "builtin"
) {
  const existing = await getCompletionForDate(userId, challengeId, date);
  if (existing) return existing;
  const [row] = await db
    .insert(challengeCompletions)
    .values({ userId, challengeId, date, source })
    .returning();
  return row;
}

export async function getRecentCompletions(userId: string, limit = 30) {
  return db
    .select()
    .from(challengeCompletions)
    .where(eq(challengeCompletions.userId, userId))
    .orderBy(desc(challengeCompletions.date))
    .limit(limit);
}

// ---------------- Date ideas ----------------
export async function getDateIdeas(filters: { category?: string; duration?: string; cost?: string }) {
  const all = await db.select().from(dateIdeas);
  return all.filter((idea: typeof dateIdeas.$inferSelect) => {
    if (filters.category && filters.category !== "vse" && idea.category !== filters.category) return false;
    if (filters.duration && idea.duration !== filters.duration) return false;
    if (filters.cost && idea.cost !== filters.cost) return false;
    return true;
  });
}

export async function getDateIdeaById(id: number) {
  const [idea] = await db.select().from(dateIdeas).where(eq(dateIdeas.id, id));
  return idea;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function upsertGoogleIdea(idea: {
  externalId: string;
  title: string;
  description: string;
  category: string;
  cost: string;
  duration: string;
  locationType: string;
  city?: string;
  address?: string;
  lat: number;
  lng: number;
}) {
  const [existing] = await db.select().from(dateIdeas).where(eq(dateIdeas.externalId, idea.externalId));
  if (existing) return existing;
  const [row] = await db.insert(dateIdeas).values(idea).onConflictDoNothing({ target: dateIdeas.externalId }).returning();
  if (row) return row;
  const [fallback] = await db.select().from(dateIdeas).where(eq(dateIdeas.externalId, idea.externalId));
  return fallback;
}

export async function getNearbyIdeas(lat: number, lng: number, types: string[], radiusKm = 5) {
  const all = await db.select().from(dateIdeas);
  return all
    .filter((idea: typeof dateIdeas.$inferSelect) => idea.lat != null && idea.lng != null)
    .filter((idea: typeof dateIdeas.$inferSelect) =>
      types.length === 0 ? true : types.includes(idea.locationType || "")
    )
    .map((idea: typeof dateIdeas.$inferSelect) => ({
      ...idea,
      distanceKm: haversineKm(lat, lng, idea.lat!, idea.lng!),
    }))
    .filter((idea: { distanceKm: number }) => idea.distanceKm <= radiusKm)
    .sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm);
}

// ---------------- Planned dates ----------------
export async function createPlannedDate(
  userId: string,
  ideaId: number,
  scheduledAt: Date,
  notes: string | undefined
) {
  const [row] = await db
    .insert(plannedDates)
    .values({ userId, ideaId, scheduledAt, notes })
    .returning();
  return row;
}

export async function getPlannedDates(userId: string) {
  return db
    .select()
    .from(plannedDates)
    .where(eq(plannedDates.userId, userId))
    .orderBy(plannedDates.scheduledAt);
}

export async function getUpcomingPlannedDates(userId: string, limit = 3) {
  const all = await getPlannedDates(userId);
  const now = new Date();
  return all
    .filter((d: typeof plannedDates.$inferSelect) => !d.completed && new Date(d.scheduledAt) >= now)
    .slice(0, limit);
}

export async function updatePlannedDate(
  id: number,
  userId: string,
  patch: Partial<{ scheduledAt: Date; notes: string; completed: boolean }>
) {
  const [row] = await db
    .update(plannedDates)
    .set(patch)
    .where(and(eq(plannedDates.id, id), eq(plannedDates.userId, userId)))
    .returning();
  return row;
}

export async function deletePlannedDate(id: number, userId: string) {
  await db.delete(plannedDates).where(and(eq(plannedDates.id, id), eq(plannedDates.userId, userId)));
}

// ---------------- Stats & timeline ----------------
export async function getStats(userId: string) {
  const recentMoods = await getRecentMoods(userId, 30);
  const recentAnswers = await getRecentAnswers(userId, 30);
  const recentCompletions = await getRecentCompletions(userId, 30);
  const avgMood =
    recentMoods.length > 0
      ? Math.round((recentMoods.reduce((sum: number, m: { level: number }) => sum + m.level, 0) / recentMoods.length) * 10) / 10
      : 0;
  return {
    moodCount: recentMoods.length,
    answeredCount: recentAnswers.length,
    completedCount: recentCompletions.length,
    avgMood,
  };
}

export type TimelineEntry = {
  type: "mood" | "answer" | "challenge";
  date: string;
  userId: string;
  detail: any;
};

export async function getTimeline(userIds: string[], limit = 20): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  for (const userId of userIds) {
    const [m, a, c] = await Promise.all([
      getRecentMoods(userId, limit),
      getRecentAnswers(userId, limit),
      getRecentCompletions(userId, limit),
    ]);
    for (const mood of m) entries.push({ type: "mood", date: mood.date, userId, detail: mood });
    for (const answer of a) entries.push({ type: "answer", date: answer.date, userId, detail: answer });
    for (const comp of c) entries.push({ type: "challenge", date: comp.date, userId, detail: comp });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries.slice(0, limit);
}

export async function calculateStreak(userId: string): Promise<number> {
  const [m, a, c] = await Promise.all([
    getRecentMoods(userId, 60),
    getRecentAnswers(userId, 60),
    getRecentCompletions(userId, 60),
  ]);
  const activeDays = new Set<string>([
    ...m.map((x: { date: string }) => x.date),
    ...a.map((x: { date: string }) => x.date),
    ...c.map((x: { date: string }) => x.date),
  ]);
  let streak = 0;
  const cursor = new Date();
  // if today has no activity yet, streak counts from yesterday backwards
  if (!activeDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDays.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------------- Push subscriptions ----------------
export async function savePushSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  const [existing] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  if (existing) return existing;
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth })
    .returning();
  return row;
}

export async function getPushSubscriptionsForUser(userId: string) {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

// ---------------- Custom questions & challenges ----------------
export async function createCustomQuestion(user: User, text: string) {
  const [row] = await db
    .insert(customQuestions)
    .values({ coupleKey: coupleKeyFor(user), createdBy: user.id, text })
    .returning();
  return row;
}

export async function getCustomQuestions(user: User) {
  return db
    .select()
    .from(customQuestions)
    .where(eq(customQuestions.coupleKey, coupleKeyFor(user)))
    .orderBy(desc(customQuestions.createdAt));
}

export async function deleteCustomQuestion(id: number, user: User) {
  await db.delete(customQuestions).where(and(eq(customQuestions.id, id), eq(customQuestions.coupleKey, coupleKeyFor(user))));
}

export async function createCustomChallenge(user: User, text: string) {
  const [row] = await db
    .insert(customChallenges)
    .values({ coupleKey: coupleKeyFor(user), createdBy: user.id, text })
    .returning();
  return row;
}

export async function getCustomChallenges(user: User) {
  return db
    .select()
    .from(customChallenges)
    .where(eq(customChallenges.coupleKey, coupleKeyFor(user)))
    .orderBy(desc(customChallenges.createdAt));
}

export async function deleteCustomChallenge(id: number, user: User) {
  await db
    .delete(customChallenges)
    .where(and(eq(customChallenges.id, id), eq(customChallenges.coupleKey, coupleKeyFor(user))));
}

// ---------------- Reactions ----------------
export async function toggleReaction(
  userId: string,
  targetType: "mood" | "answer" | "challenge",
  targetId: number,
  emoji: string
) {
  const [existing] = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.targetType, targetType), eq(reactions.targetId, targetId), eq(reactions.userId, userId)));

  if (existing && existing.emoji === emoji) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    return null;
  }
  if (existing) {
    const [row] = await db.update(reactions).set({ emoji }).where(eq(reactions.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(reactions).values({ userId, targetType, targetId, emoji }).returning();
  return row;
}

export async function getTargetOwner(targetType: "mood" | "answer" | "challenge", targetId: number): Promise<string | undefined> {
  if (targetType === "mood") {
    const [row] = await db.select().from(moods).where(eq(moods.id, targetId));
    return row?.userId;
  }
  if (targetType === "answer") {
    const [row] = await db.select().from(questionAnswers).where(eq(questionAnswers.id, targetId));
    return row?.userId;
  }
  const [row] = await db.select().from(challengeCompletions).where(eq(challengeCompletions.id, targetId));
  return row?.userId;
}

export async function getReactionsForTargets(targetType: "mood" | "answer" | "challenge", targetIds: number[]) {
  if (targetIds.length === 0) return new Map<number, { userId: string; emoji: string }[]>();
  const all = await db.select().from(reactions).where(eq(reactions.targetType, targetType));
  const map = new Map<number, { userId: string; emoji: string }[]>();
  for (const r of all) {
    if (!targetIds.includes(r.targetId)) continue;
    const list = map.get(r.targetId) || [];
    list.push({ userId: r.userId, emoji: r.emoji });
    map.set(r.targetId, list);
  }
  return map;
}

// ---------------- Random idea ----------------
export async function getRandomDateIdea(excludeId?: number) {
  const all = await db.select().from(dateIdeas);
  const pool = excludeId ? all.filter((i: typeof dateIdeas.$inferSelect) => i.id !== excludeId) : all;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------- Scheduler helpers ----------------
export async function getAllUsers(): Promise<User[]> {
  return db.select().from(users);
}

export async function hasActivityToday(userId: string, date: string): Promise<boolean> {
  const [mood] = await db.select().from(moods).where(and(eq(moods.userId, userId), eq(moods.date, date)));
  if (mood) return true;
  const [answer] = await db
    .select()
    .from(questionAnswers)
    .where(and(eq(questionAnswers.userId, userId), eq(questionAnswers.date, date)));
  if (answer) return true;
  const [completion] = await db
    .select()
    .from(challengeCompletions)
    .where(and(eq(challengeCompletions.userId, userId), eq(challengeCompletions.date, date)));
  return !!completion;
}

export function deriveReminderTime(user: User, date: string): string {
  if (user.reminderTime !== "random") return user.reminderTime;
  // Deterministic pseudo-random hour (9-21) derived from user id + date, stable for the whole day.
  const hour = 9 + (dayIndex(user.id + date) % 13);
  return `${String(hour).padStart(2, "0")}:00`;
}

export async function wasReminderSent(userId: string, date: string, type: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(reminderLog)
    .where(and(eq(reminderLog.userId, userId), eq(reminderLog.date, date), eq(reminderLog.type, type)));
  return !!row;
}

export async function markReminderSent(userId: string, date: string, type: string) {
  await db.insert(reminderLog).values({ userId, date, type }).onConflictDoNothing();
}

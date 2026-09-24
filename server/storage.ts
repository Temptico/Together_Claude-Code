import { eq, and, or, desc, gte, lte, lt, asc, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db.js";
import {
  users,
  loginCodes,
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
  wishlistItems,
  milestoneEvents,
  feedback,
  tempticoClicks,
  landingVisits,
  gamePrompts,
  gameRounds,
  gameRoundAnswers,
  GAME_SLUGS,
  type User,
  type GameSlug,
  type GamePrompt,
} from "../shared/schema.js";
import { customAlphabet } from "nanoid";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const idGen = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 20);
const codeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Strips the PIN hash before a user row is ever sent to a client.
export function omitPin<T extends { pin?: string | null }>(user: T): Omit<T, "pin"> {
  const { pin, ...rest } = user;
  return rest;
}

// YYYY-MM-DD in the server's local time zone (see tz.ts). Not
// toISOString(), which is always UTC — that made "today" roll over at
// 02:00 in Slovenia in summer.
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr(): string {
  return localDateKey();
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
export async function createUser(name: string, email: string, language?: string, source?: string): Promise<User> {
  let connectCode = codeGen();
  // extremely unlikely collision, but guard anyway
  while (await getUserByConnectCode(connectCode)) connectCode = codeGen();
  const values: typeof users.$inferInsert = { id: idGen(), name, email, connectCode };
  if (language) values.language = language;
  if (source) values.source = source;
  const [user] = await db.insert(users).values(values).returning();
  return user;
}

// ---------------- Acquisition tracking ----------------
export async function recordLandingVisit(source: string): Promise<void> {
  await db.insert(landingVisits).values({ source });
}

const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;

// One-time login code, emailed to the user in place of a PIN. Any prior
// unused code for this user is invalidated first, so only the most recently
// requested one ever works — requesting a new code silently supersedes an
// older, forgotten one instead of leaving both valid.
export async function createLoginCode(userId: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hashPin(code); // generic bcrypt hash — same helper the old PIN used
  await db.delete(loginCodes).where(and(eq(loginCodes.userId, userId), isNull(loginCodes.usedAt)));
  await db.insert(loginCodes).values({ userId, codeHash, expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS) });
  return code;
}

export async function verifyLoginCode(userId: string, code: string): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.userId, userId), isNull(loginCodes.usedAt), gte(loginCodes.expiresAt, now)))
    .orderBy(desc(loginCodes.createdAt));
  for (const row of rows) {
    if (await verifyPin(code, row.codeHash)) {
      await db.update(loginCodes).set({ usedAt: now }).where(eq(loginCodes.id, row.id));
      return true;
    }
  }
  return false;
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

// Clears a user's PIN so they can claim a new one on their next login —
// the only recovery path since there's no email-based reset flow.
export async function deleteUserAccount(user: User): Promise<void> {
  // Right-to-erasure account deletion: removes every row that references
  // this user, unlinks them from their partner, and finally the account
  // itself. Content the user created but shared with their partner (planned
  // dates, custom questions/challenges) is deleted too rather than
  // reassigned, which is the simplest and safest reading of "erase my data."
  if (user.partnerId) {
    await db.update(users).set({ partnerId: null }).where(eq(users.id, user.partnerId));
  }

  await db.delete(moods).where(eq(moods.userId, user.id));
  await db.delete(questionAnswers).where(eq(questionAnswers.userId, user.id));
  await db.delete(challengeCompletions).where(eq(challengeCompletions.userId, user.id));
  await db.delete(plannedDates).where(eq(plannedDates.userId, user.id));
  await db.delete(customQuestions).where(eq(customQuestions.createdBy, user.id));
  await db.delete(customChallenges).where(eq(customChallenges.createdBy, user.id));
  await db.delete(wishlistItems).where(eq(wishlistItems.createdBy, user.id));
  await db.delete(reactions).where(eq(reactions.userId, user.id));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
  await db.delete(reminderLog).where(eq(reminderLog.userId, user.id));
  await db.delete(gameRoundAnswers).where(eq(gameRoundAnswers.userId, user.id));
  await db.delete(dailyAssignments).where(eq(dailyAssignments.coupleKey, coupleKeyFor(user)));

  await db.delete(users).where(eq(users.id, user.id));
}

// Unlinks a couple without deleting either account. Couple-keyed content
// (daily picks, custom questions/challenges, wishlist, game rounds) is left
// in place — it's unreachable under each user's new solo coupleKey and
// reappears only if these same two people reconnect. Both connect codes are
// regenerated: connecting needs nothing but the other person's code, so an
// ex who still knows the old one could otherwise silently re-link.
export async function disconnectPartner(user: User): Promise<User> {
  if (user.partnerId) {
    await db.update(users).set({ partnerId: null, connectCode: codeGen() }).where(eq(users.id, user.partnerId));
  }
  const [updated] = await db
    .update(users)
    .set({ partnerId: null, connectCode: codeGen() })
    .where(eq(users.id, user.id))
    .returning();
  return updated;
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

// Builtin questions/challenges are authored in Slovenian with optional EN/HR
// translations; custom (user-written) ones only ever exist in one language,
// so this is only applied to builtin rows.
export function pickLocalizedText(row: { text: string; textEn: string | null; textHr: string | null }, language: string): string {
  if (language === "en") return row.textEn || row.text;
  if (language === "hr") return row.textHr || row.text;
  return row.text;
}

// Date ideas are authored in Slovenian with optional EN/HR translations,
// same pattern as questions/challenges but across two fields (title +
// description) instead of one. Externally-sourced entries (OSM/Google) never
// have translations — this just falls back to the raw scraped text for those.
export function pickDateIdea<T extends { title: string; titleEn: string | null; titleHr: string | null; description: string; descriptionEn: string | null; descriptionHr: string | null }>(
  idea: T,
  language?: string
): T {
  if (!language || language === "sl") return idea;
  const title = language === "en" ? idea.titleEn || idea.title : language === "hr" ? idea.titleHr || idea.title : idea.title;
  const description =
    language === "en" ? idea.descriptionEn || idea.description : language === "hr" ? idea.descriptionHr || idea.description : idea.description;
  return { ...idea, title, description };
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
      if (builtin)
        return { id: builtin.id, text: pickLocalizedText(builtin, user.language), category: builtin.category, isCustom: false };
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
  return { id: builtin.id, text: pickLocalizedText(builtin, user.language), category: builtin.category, isCustom: false };
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

export type ResolvedChallenge = {
  id: number;
  text: string;
  category: string;
  difficulty: string;
  isCustom: boolean;
  // The daily_assignments row's own date — NOT always "today". Callers must
  // use this (not todayStr()) when accepting/completing, so the completion
  // is matched back to the right assignment by resolveDailyChallenge/
  // isChallengeAssignmentOpen.
  date: string;
};

async function resolveAssignedChallenge(
  assignment: { date: string; source: string; itemId: number },
  language: string
): Promise<ResolvedChallenge | undefined> {
  if (assignment.source === "custom") {
    const [custom] = await db.select().from(customChallenges).where(eq(customChallenges.id, assignment.itemId));
    if (!custom) return undefined;
    return { id: custom.id, text: custom.text, category: "lastno", difficulty: "easy", isCustom: true, date: assignment.date };
  }
  const [builtin] = await db.select().from(challenges).where(eq(challenges.id, assignment.itemId));
  if (!builtin) return undefined;
  return {
    id: builtin.id,
    text: pickLocalizedText(builtin, language),
    category: builtin.category,
    difficulty: builtin.difficulty,
    isCustom: false,
    date: assignment.date,
  };
}

// True once anyone in the couple has actually finished the challenge this
// assignment points to — checked by (challengeId, assignment date), which is
// what challengeCompletions.date means now that completions can happen on a
// later calendar day than the assignment itself.
async function isChallengeAssignmentOpen(assignment: { date: string; itemId: number }, coupleIds: string[]): Promise<boolean> {
  const rows = await db
    .select()
    .from(challengeCompletions)
    .where(
      and(
        eq(challengeCompletions.challengeId, assignment.itemId),
        eq(challengeCompletions.date, assignment.date),
        isNotNull(challengeCompletions.completedAt)
      )
    );
  return !rows.some((r: typeof challengeCompletions.$inferSelect) => coupleIds.includes(r.userId));
}

export async function resolveDailyChallenge(user: User, date: string): Promise<ResolvedChallenge | undefined> {
  const coupleKey = coupleKeyFor(user);
  const coupleIds = user.partnerId ? [user.id, user.partnerId] : [user.id];

  // An unfinished challenge from an earlier day stays "the" daily challenge
  // — a fresh one only rotates in once someone in the couple actually
  // completes it, so an abandoned challenge doesn't silently get swapped out
  // overnight.
  const [mostRecentPast] = await db
    .select()
    .from(dailyAssignments)
    .where(and(eq(dailyAssignments.coupleKey, coupleKey), eq(dailyAssignments.type, "challenge"), lt(dailyAssignments.date, date)))
    .orderBy(desc(dailyAssignments.date))
    .limit(1);

  if (mostRecentPast && (await isChallengeAssignmentOpen(mostRecentPast, coupleIds))) {
    const resolved = await resolveAssignedChallenge(mostRecentPast, user.language);
    if (resolved) return resolved;
  }

  const [existingAssignment] = await db
    .select()
    .from(dailyAssignments)
    .where(
      and(eq(dailyAssignments.coupleKey, coupleKey), eq(dailyAssignments.date, date), eq(dailyAssignments.type, "challenge"))
    );

  if (existingAssignment) {
    const resolved = await resolveAssignedChallenge(existingAssignment, user.language);
    if (resolved) return resolved;
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
    return { id: pendingCustom.id, text: pendingCustom.text, category: "lastno", difficulty: "easy", isCustom: true, date };
  }

  const builtin = await getBuiltinChallengeOfTheDay(date, coupleKey);
  if (!builtin) return undefined;
  await db
    .insert(dailyAssignments)
    .values({ coupleKey, date, type: "challenge", itemId: builtin.id, source: "builtin" })
    .onConflictDoNothing();
  return {
    id: builtin.id,
    text: pickLocalizedText(builtin, user.language),
    category: builtin.category,
    difficulty: builtin.difficulty,
    isCustom: false,
    date,
  };
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

export async function acceptChallenge(
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

// Marks an already-accepted challenge as done. Returns undefined if it was
// never accepted — completing isn't possible without accepting first.
export async function markChallengeCompleted(userId: string, challengeId: number, date: string) {
  const existing = await getCompletionForDate(userId, challengeId, date);
  if (!existing) return undefined;
  if (existing.completedAt) return existing;
  const [row] = await db
    .update(challengeCompletions)
    .set({ completedAt: new Date() })
    .where(eq(challengeCompletions.id, existing.id))
    .returning();
  return row;
}

// Only counts challenges that were actually finished, not just accepted —
// used for streaks, memories, and activity tracking. Ordered by completedAt
// (when it was actually done), not the assignment date — a rolled-over
// challenge finished today can have a much older assignment date.
export async function getRecentCompletions(userId: string, limit = 30) {
  return db
    .select()
    .from(challengeCompletions)
    .where(and(eq(challengeCompletions.userId, userId), isNotNull(challengeCompletions.completedAt)))
    .orderBy(desc(challengeCompletions.completedAt))
    .limit(limit);
}

// ---------------- Date ideas ----------------
export async function getDateIdeas(filters: { category?: string; duration?: string; cost?: string }, language?: string) {
  const all = await db.select().from(dateIdeas);
  const filtered = all.filter((idea: typeof dateIdeas.$inferSelect) => {
    // Externally-sourced entries (OSM/Google, upserted from nearby search)
    // only belong in "Najdi v bližini" results — they lack a real
    // description/duration/cost and would look out of place mixed into the
    // hand-curated catalog.
    if (idea.externalId != null) return false;
    // A couple's own manually-typed date ideas are never shown to anyone
    // else — they're only ever reached by id, through that couple's own
    // planned date.
    if (idea.custom) return false;
    if (filters.category && filters.category !== "vse" && idea.category !== filters.category) return false;
    if (filters.duration && idea.duration !== filters.duration) return false;
    if (filters.cost && idea.cost !== filters.cost) return false;
    return true;
  });
  // Ideas tied to a specific city (currently all Ljubljana) sort after the
  // location-agnostic ones, so someone browsing from anywhere else sees
  // relevant content first instead of a screen full of "Ljubljana" badges —
  // Ljubljana-based users still see them, just after the universal ones.
  const sorted = [...filtered].sort((a: typeof dateIdeas.$inferSelect, b: typeof dateIdeas.$inferSelect) => {
    const aCity = a.city ? 1 : 0;
    const bCity = b.city ? 1 : 0;
    return aCity - bCity;
  });
  return sorted.map((idea) => pickDateIdea(idea, language));
}

export async function getDateIdeaById(id: number, language?: string) {
  const [idea] = await db.select().from(dateIdeas).where(eq(dateIdeas.id, id));
  return idea ? pickDateIdea(idea, language) : idea;
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

export async function upsertExternalIdea(idea: {
  externalId: string;
  title: string;
  description: string;
  category: string;
  cost: string;
  duration: string;
  locationType: string;
  city?: string;
  address?: string;
  phone?: string;
  website?: string;
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

export async function getNearbyIdeas(lat: number, lng: number, types: string[], radiusKm = 5, language?: string) {
  const all = await db.select().from(dateIdeas);
  return all
    .filter((idea: typeof dateIdeas.$inferSelect) => idea.lat != null && idea.lng != null)
    .filter((idea: typeof dateIdeas.$inferSelect) =>
      types.length === 0 ? true : types.includes(idea.locationType || "")
    )
    .map((idea: typeof dateIdeas.$inferSelect) => ({
      ...pickDateIdea(idea, language),
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

// A user's own idea, typed in directly rather than picked from the catalog.
// Modeled as a one-off `date_ideas` row flagged `custom` (so it never shows
// up in anyone's browsing/search) that the new planned date then points at
// — this reuses everything else planned dates already do (photos,
// completion, reminders, idea title lookups) with no separate code path.
export async function createCustomDateIdea(title: string, description: string) {
  const [idea] = await db
    .insert(dateIdeas)
    .values({
      title,
      description: description || title,
      category: "doma",
      cost: "eur",
      duration: "1h",
      custom: true,
    })
    .returning();
  return idea;
}

export async function createCustomPlannedDate(
  userId: string,
  title: string,
  description: string,
  scheduledAt: Date,
  notes: string | undefined
) {
  const idea = await createCustomDateIdea(title, description);
  const row = await createPlannedDate(userId, idea.id, scheduledAt, notes);
  return { ...row, idea };
}

function coupleIds(user: User): string[] {
  return user.partnerId ? [user.id, user.partnerId] : [user.id];
}

export async function getPlannedDates(user: User) {
  return db
    .select()
    .from(plannedDates)
    .where(inArray(plannedDates.userId, coupleIds(user)))
    .orderBy(plannedDates.scheduledAt);
}

// Admin-only diagnostic: summarizes a user's planned dates without returning
// the (potentially large) base64 photo payloads themselves — just whether
// each row has one. Used to investigate "my photos disappeared" reports.
export async function getPlannedDatesDebug(user: User) {
  const rows = await getPlannedDates(user);
  return rows.map((d: typeof plannedDates.$inferSelect) => ({
    id: d.id,
    userId: d.userId,
    ideaId: d.ideaId,
    scheduledAt: d.scheduledAt,
    completed: d.completed,
    hasPhoto: !!d.photo,
    photoLength: d.photo ? d.photo.length : 0,
    createdAt: d.createdAt,
  }));
}

export async function getUpcomingPlannedDates(user: User, limit = 3) {
  const all = await getPlannedDates(user);
  const now = new Date();
  return all
    .filter((d: typeof plannedDates.$inferSelect) => !d.completed && new Date(d.scheduledAt) >= now)
    .slice(0, limit);
}

export async function updatePlannedDate(
  id: number,
  user: User,
  patch: Partial<{ scheduledAt: Date; notes: string; completed: boolean; photo: string | null }>
) {
  const [row] = await db
    .update(plannedDates)
    .set(patch)
    .where(and(eq(plannedDates.id, id), inArray(plannedDates.userId, coupleIds(user))))
    .returning();
  return row;
}

export async function deletePlannedDate(id: number, user: User) {
  await db.delete(plannedDates).where(and(eq(plannedDates.id, id), inArray(plannedDates.userId, coupleIds(user))));
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
  type: "mood" | "answer" | "challenge" | "date";
  date: string;
  userId: string;
  detail: any;
};

function dateKeyFromTimestamp(d: Date): string {
  return localDateKey(d);
}

// A challenge can now be accepted/completed days after it was assigned (see
// resolveDailyChallenge's rollover), so challengeCompletions.date means
// "which daily pick this belongs to," not "when it was actually done" —
// anything that needs the real day (streaks, "active today", on-this-day
// memories) must filter on completedAt instead.
function completedOnDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const nextDayStart = new Date(y, m - 1, d + 1);
  return and(gte(challengeCompletions.completedAt, start), lt(challengeCompletions.completedAt, nextDayStart));
}

async function getRecentCompletedDates(userId: string, limit: number) {
  const rows = await db
    .select()
    .from(plannedDates)
    .where(and(eq(plannedDates.userId, userId), eq(plannedDates.completed, true)))
    .orderBy(desc(plannedDates.scheduledAt))
    .limit(limit);
  return Promise.all(
    rows.map(async (row: typeof plannedDates.$inferSelect) => ({
      ...row,
      idea: await getDateIdeaById(row.ideaId),
    }))
  );
}

// Moods/answers/challenges — the "Recent" section of Memories.
export async function getActivityTimeline(userIds: string[], limit = 20): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  for (const userId of userIds) {
    const [m, a, c] = await Promise.all([
      getRecentMoods(userId, limit),
      getRecentAnswers(userId, limit),
      getRecentCompletions(userId, limit),
    ]);
    for (const mood of m) entries.push({ type: "mood", date: mood.date, userId, detail: mood });
    for (const answer of a) entries.push({ type: "answer", date: answer.date, userId, detail: answer });
    for (const comp of c)
      entries.push({
        type: "challenge",
        date: comp.completedAt ? dateKeyFromTimestamp(new Date(comp.completedAt)) : comp.date,
        userId,
        detail: comp,
      });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries.slice(0, limit);
}

// Completed planned dates — the "Past dates" section of Memories, kept
// separate so busy mood/challenge activity can't crowd dates out of a
// shared limit.
export async function getPastDatesTimeline(userIds: string[], limit = 20): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  for (const userId of userIds) {
    const d = await getRecentCompletedDates(userId, limit);
    for (const planned of d)
      entries.push({ type: "date", date: dateKeyFromTimestamp(new Date(planned.scheduledAt)), userId, detail: planned });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries.slice(0, limit);
}

export async function getOnThisDayMemories(userIds: string[]): Promise<TimelineEntry[]> {
  const now = new Date();
  const targetDate = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const entries: TimelineEntry[] = [];
  for (const userId of userIds) {
    const [m, a, c, plannedRows] = await Promise.all([
      db.select().from(moods).where(and(eq(moods.userId, userId), eq(moods.date, targetDate))),
      db.select().from(questionAnswers).where(and(eq(questionAnswers.userId, userId), eq(questionAnswers.date, targetDate))),
      db
        .select()
        .from(challengeCompletions)
        .where(and(eq(challengeCompletions.userId, userId), completedOnDate(targetDate))),
      db.select().from(plannedDates).where(and(eq(plannedDates.userId, userId), eq(plannedDates.completed, true))),
    ]);
    for (const mood of m) entries.push({ type: "mood", date: mood.date, userId, detail: mood });
    for (const answer of a) entries.push({ type: "answer", date: answer.date, userId, detail: answer });
    for (const comp of c) entries.push({ type: "challenge", date: targetDate, userId, detail: comp });
    for (const planned of plannedRows as (typeof plannedDates.$inferSelect)[]) {
      if (dateKeyFromTimestamp(new Date(planned.scheduledAt)) !== targetDate) continue;
      entries.push({ type: "date", date: targetDate, userId, detail: { ...planned, idea: await getDateIdeaById(planned.ideaId) } });
    }
  }
  return entries;
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
    // completedAt (when it actually happened), not the assignment date — a
    // rolled-over challenge finished today must count toward today's streak
    // even if it was originally assigned days ago.
    ...c.map((x: { date: string; completedAt: Date | null }) => (x.completedAt ? dateKeyFromTimestamp(new Date(x.completedAt)) : x.date)),
  ]);
  let streak = 0;
  const cursor = new Date();
  // if today has no activity yet, streak counts from yesterday backwards
  if (!activeDays.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDays.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------------- Milestones ----------------
const MILESTONE_STREAK_THRESHOLDS = [7, 30, 60, 100, 365];

// Called right after any activity that can move the streak (mood, answer,
// challenge completion) — checks whether that action just pushed the streak
// to exactly one of the thresholds, and if this user has never hit that
// particular one before, records it. Returns the newly-crossed milestone so
// the caller can fire a push notification, or undefined if nothing new
// happened (the vastly more common case — most activity doesn't land on a
// round number).
export async function checkStreakMilestone(userId: string): Promise<{ id: number; type: string; value: number } | undefined> {
  const streak = await calculateStreak(userId);
  if (!MILESTONE_STREAK_THRESHOLDS.includes(streak)) return undefined;
  const type = `streak_${streak}`;
  const [inserted] = await db
    .insert(milestoneEvents)
    .values({ userId, type, value: streak })
    .onConflictDoNothing({ target: [milestoneEvents.userId, milestoneEvents.type] })
    .returning();
  return inserted;
}

export async function getPendingMilestone(userId: string) {
  const [row] = await db
    .select()
    .from(milestoneEvents)
    .where(and(eq(milestoneEvents.userId, userId), isNull(milestoneEvents.dismissedAt)))
    .orderBy(desc(milestoneEvents.createdAt))
    .limit(1);
  return row;
}

export async function dismissMilestone(id: number, userId: string) {
  await db
    .update(milestoneEvents)
    .set({ dismissedAt: new Date() })
    .where(and(eq(milestoneEvents.id, id), eq(milestoneEvents.userId, userId)));
}

// ---------------- Temptico click tracking ----------------
export async function recordTempticoClick(userId: string, source: string) {
  await db.insert(tempticoClicks).values({ userId, source });
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

// ---------------- Wishlist ----------------
export async function getWishlist(user: User) {
  return db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.coupleKey, coupleKeyFor(user)))
    .orderBy(desc(wishlistItems.createdAt));
}

export async function createWishlistItem(user: User, text: string) {
  const [row] = await db
    .insert(wishlistItems)
    .values({ coupleKey: coupleKeyFor(user), createdBy: user.id, text })
    .returning();
  return row;
}

export async function updateWishlistItem(id: number, user: User, completed: boolean) {
  const [row] = await db
    .update(wishlistItems)
    .set({ completed })
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.coupleKey, coupleKeyFor(user))))
    .returning();
  return row;
}

export async function deleteWishlistItem(id: number, user: User) {
  await db.delete(wishlistItems).where(and(eq(wishlistItems.id, id), eq(wishlistItems.coupleKey, coupleKeyFor(user))));
}

// ---------------- Reactions ----------------
export async function toggleReaction(
  userId: string,
  targetType: "mood" | "answer" | "challenge" | "game_answer",
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

export async function getTargetOwner(
  targetType: "mood" | "answer" | "challenge" | "game_answer",
  targetId: number
): Promise<string | undefined> {
  if (targetType === "mood") {
    const [row] = await db.select().from(moods).where(eq(moods.id, targetId));
    return row?.userId;
  }
  if (targetType === "answer") {
    const [row] = await db.select().from(questionAnswers).where(eq(questionAnswers.id, targetId));
    return row?.userId;
  }
  if (targetType === "game_answer") {
    const [row] = await db.select().from(gameRoundAnswers).where(eq(gameRoundAnswers.id, targetId));
    return row?.userId;
  }
  const [row] = await db.select().from(challengeCompletions).where(eq(challengeCompletions.id, targetId));
  return row?.userId;
}

export async function getReactionsForTargets(targetType: "mood" | "answer" | "challenge" | "game_answer", targetIds: number[]) {
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

// ---------------- Games ----------------
// A "round" is one shared deck of prompts a couple plays through for a given
// game — the whole authored library at once (currently 15 per game), not an
// open-ended daily drip like questions/challenges — reused while still open
// so both partners answer the exact same deck.

function pickLocalizedOption(
  row: { optionA: string | null; optionAEn: string | null; optionAHr: string | null; optionB: string | null; optionBEn: string | null; optionBHr: string | null },
  language: string
): { optionA: string; optionB: string } | null {
  if (!row.optionA || !row.optionB) return null;
  if (language === "en") return { optionA: row.optionAEn || row.optionA, optionB: row.optionBEn || row.optionB };
  if (language === "hr") return { optionA: row.optionAHr || row.optionA, optionB: row.optionBHr || row.optionB };
  return { optionA: row.optionA, optionB: row.optionB };
}

// Shapes a prompt row for the client: localized text (+ options for
// "choice"-format games), with no raw translation columns leaking through.
export function localizeGamePrompt(prompt: GamePrompt, language?: string) {
  const lang = language || "sl";
  const options = pickLocalizedOption(prompt, lang);
  return {
    id: prompt.id,
    gameSlug: prompt.gameSlug,
    text: pickLocalizedText(prompt, lang),
    optionA: options?.optionA,
    optionB: options?.optionB,
  };
}

export async function getGamePrompts(gameSlug: GameSlug): Promise<GamePrompt[]> {
  return db.select().from(gamePrompts).where(eq(gamePrompts.gameSlug, gameSlug));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function roundIsComplete(round: typeof gameRounds.$inferSelect, coupleIds: string[]): Promise<boolean> {
  if (coupleIds.length < 2) return false; // no partner yet — a round can never "complete" solo
  const promptIds: number[] = JSON.parse(round.promptIds);
  const answers = await db.select().from(gameRoundAnswers).where(eq(gameRoundAnswers.roundId, round.id));
  return promptIds.every((pid) =>
    coupleIds.every((uid) => answers.some((a: typeof gameRoundAnswers.$inferSelect) => a.promptId === pid && a.userId === uid))
  );
}

// Returns the couple's current deck for this game — resuming an
// already-open one, or starting a fresh one (excluding prompts used in
// past rounds for this couple+game, falling back to allowing repeats once
// the library is exhausted) if none is open.
export async function getOrCreateGameRound(user: User, gameSlug: GameSlug) {
  const coupleKey = coupleKeyFor(user);
  const coupleIds = user.partnerId ? [user.id, user.partnerId] : [user.id];

  const existingRounds = await db
    .select()
    .from(gameRounds)
    .where(and(eq(gameRounds.coupleKey, coupleKey), eq(gameRounds.gameSlug, gameSlug)))
    .orderBy(desc(gameRounds.createdAt));

  if (existingRounds.length > 0) {
    const latest = existingRounds[0];
    if (!(await roundIsComplete(latest, coupleIds))) return { round: latest, isNew: false };
  }

  const allPrompts = await getGamePrompts(gameSlug);
  if (allPrompts.length === 0) return undefined;
  const usedIds = new Set(existingRounds.flatMap((r: typeof gameRounds.$inferSelect) => JSON.parse(r.promptIds) as number[]));
  const unused = allPrompts.filter((p) => !usedIds.has(p.id));
  const pool = unused.length > 0 ? unused : allPrompts;
  const promptIds = shuffle(pool).map((p) => p.id);

  const [round] = await db
    .insert(gameRounds)
    .values({ coupleKey, gameSlug, promptIds: JSON.stringify(promptIds), createdBy: user.id })
    .returning();
  return { round, isNew: true };
}

export async function getGameRoundById(id: number) {
  const [round] = await db.select().from(gameRounds).where(eq(gameRounds.id, id));
  return round;
}

export async function getGameRoundAnswers(roundId: number) {
  return db.select().from(gameRoundAnswers).where(eq(gameRoundAnswers.roundId, roundId));
}

export async function submitGameRoundAnswer(roundId: number, userId: string, promptId: number, answer: string) {
  const [row] = await db
    .insert(gameRoundAnswers)
    .values({ roundId, promptId, userId, answer })
    .onConflictDoUpdate({
      target: [gameRoundAnswers.roundId, gameRoundAnswers.promptId, gameRoundAnswers.userId],
      set: { answer },
    })
    .returning();
  return row;
}

// Small per-game progress summary for the Home screen's game cards —
// how many of the current deck's prompts this user (and their partner)
// have answered so far, without shipping the full deck/answers.
export async function getGamesSummary(user: User) {
  const coupleKey = coupleKeyFor(user);
  const summary: Record<string, { total: number; mine: number; partnerDone: number }> = {};
  for (const slug of GAME_SLUGS) {
    const rounds = await db
      .select()
      .from(gameRounds)
      .where(and(eq(gameRounds.coupleKey, coupleKey), eq(gameRounds.gameSlug, slug)))
      .orderBy(desc(gameRounds.createdAt))
      .limit(1);
    if (rounds.length === 0) {
      summary[slug] = { total: 0, mine: 0, partnerDone: 0 };
      continue;
    }
    const round = rounds[0];
    const promptIds: number[] = JSON.parse(round.promptIds);
    const answers = await getGameRoundAnswers(round.id);
    summary[slug] = {
      total: promptIds.length,
      mine: answers.filter((a: typeof gameRoundAnswers.$inferSelect) => a.userId === user.id).length,
      partnerDone: user.partnerId
        ? answers.filter((a: typeof gameRoundAnswers.$inferSelect) => a.userId === user.partnerId).length
        : 0,
    };
  }
  return summary;
}

// ---------------- Random idea ----------------
export async function getRandomDateIdea(excludeId?: number, language?: string) {
  const all = await db.select().from(dateIdeas);
  // "Surprise me" must work for every user regardless of where they live, so
  // it only draws from curated ideas with no city tied to them (not sourced
  // from OSM either) — most of the curated catalog is Ljubljana-specific,
  // which made this feature useless for anyone testing from elsewhere.
  const curated = all.filter((i: typeof dateIdeas.$inferSelect) => i.externalId == null && i.city == null);
  const pool = excludeId ? curated.filter((i: typeof dateIdeas.$inferSelect) => i.id !== excludeId) : curated;
  if (pool.length === 0) return undefined;
  return pickDateIdea(pool[Math.floor(Math.random() * pool.length)], language);
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
    .where(
      and(
        eq(challengeCompletions.userId, userId),
        completedOnDate(date)
      )
    );
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

// ---------------- Feedback ----------------
export async function createFeedback(userId: string, category: string, text: string) {
  const [row] = await db.insert(feedback).values({ userId, category, text }).returning();
  return row;
}

// Admin-only read: joins in the author's name/email so the dashboard doesn't
// need a second round trip per row.
export async function getAllFeedbackWithUsers() {
  const rows = await db
    .select({
      id: feedback.id,
      category: feedback.category,
      text: feedback.text,
      createdAt: feedback.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.createdAt));
  return rows;
}

// ---------------- Admin ----------------
export async function getAdminStats() {
  const allUsers = await db.select().from(users);
  const today = todayStr();
  const weekAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = localDateKey(weekAgoDate);

  const totalUsers = allUsers.length;
  const connectedUsers = allUsers.filter((u: User) => u.partnerId).length;
  const connectedCouples = Math.round(connectedUsers / 2);
  const newThisWeek = allUsers.filter((u: User) => u.createdAt >= weekAgoDate).length;

  const [
    todayMoods,
    todayAnswers,
    todayCompletions,
    weekMoods,
    weekAnswers,
    weekCompletions,
    allMoods,
    allAnswers,
    allCompletions,
    allPlanned,
    allWishlist,
    subs,
  ] = await Promise.all([
    db.select().from(moods).where(eq(moods.date, today)),
    db.select().from(questionAnswers).where(eq(questionAnswers.date, today)),
    db.select().from(challengeCompletions).where(completedOnDate(today)),
    db.select().from(moods).where(gte(moods.date, weekAgoStr)),
    db.select().from(questionAnswers).where(gte(questionAnswers.date, weekAgoStr)),
    db.select().from(challengeCompletions).where(gte(challengeCompletions.completedAt, weekAgoDate)),
    db.select().from(moods),
    db.select().from(questionAnswers),
    db.select().from(challengeCompletions).where(isNotNull(challengeCompletions.completedAt)),
    db.select().from(plannedDates),
    db.select().from(wishlistItems),
    db.select().from(pushSubscriptions),
  ]);

  const [allMilestones, allTempticoClicks, allLandingVisits, allGameRounds, streaks] = await Promise.all([
    db.select().from(milestoneEvents),
    db.select().from(tempticoClicks),
    db.select().from(landingVisits),
    db.select().from(gameRounds),
    Promise.all(allUsers.map((u: User) => calculateStreak(u.id))),
  ]);

  const gameRoundsBySlug: Record<string, number> = {};
  for (const r of allGameRounds as { gameSlug: string }[]) gameRoundsBySlug[r.gameSlug] = (gameRoundsBySlug[r.gameSlug] || 0) + 1;

  const streakDistribution = { zero: 0, d1to6: 0, d7to29: 0, d30to59: 0, d60to99: 0, d100plus: 0 };
  for (const s of streaks) {
    if (s === 0) streakDistribution.zero++;
    else if (s < 7) streakDistribution.d1to6++;
    else if (s < 30) streakDistribution.d7to29++;
    else if (s < 60) streakDistribution.d30to59++;
    else if (s < 100) streakDistribution.d60to99++;
    else streakDistribution.d100plus++;
  }

  const milestonesByType: Record<string, number> = {};
  for (const m of allMilestones as { type: string }[]) milestonesByType[m.type] = (milestonesByType[m.type] || 0) + 1;

  const tempticoClicksBySource: Record<string, number> = {};
  for (const c of allTempticoClicks as { source: string }[])
    tempticoClicksBySource[c.source] = (tempticoClicksBySource[c.source] || 0) + 1;

  // Acquisition: landing visits (anyone who arrived via a tagged QR/link,
  // whether or not they ever registered) vs. actual signups per source —
  // pairing the two is what turns "N scans" into a real conversion number.
  const visitsBySource: Record<string, number> = {};
  for (const v of allLandingVisits as { source: string }[]) visitsBySource[v.source] = (visitsBySource[v.source] || 0) + 1;
  const signupsBySource: Record<string, number> = {};
  for (const u of allUsers as User[]) if (u.source) signupsBySource[u.source] = (signupsBySource[u.source] || 0) + 1;

  const activeTodaySet = new Set<string>();
  for (const m of todayMoods) activeTodaySet.add(m.userId);
  for (const a of todayAnswers) activeTodaySet.add(a.userId);
  for (const c of todayCompletions) activeTodaySet.add(c.userId);

  const activeThisWeekSet = new Set<string>();
  for (const m of weekMoods) activeThisWeekSet.add(m.userId);
  for (const a of weekAnswers) activeThisWeekSet.add(a.userId);
  for (const c of weekCompletions) activeThisWeekSet.add(c.userId);

  const notificationsOptedIn = allUsers.filter((u: User) => u.notificationsEnabled).length;
  const usersWithPushSub = new Set(subs.map((s: { userId: string }) => s.userId)).size;
  const pwaInstalledCount = allUsers.filter((u: User) => u.pwaInstalledAt).length;

  const languageCounts: Record<string, number> = {};
  for (const u of allUsers as User[]) languageCounts[u.language] = (languageCounts[u.language] || 0) + 1;

  const recentUsers = [...allUsers]
    .sort((a: User, b: User) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 500) // effectively "all users" for this app's scale — admin table doubles as the account-management list
    .map((u: User) => ({ name: u.name, email: u.email, connected: !!u.partnerId, createdAt: u.createdAt, source: u.source }));

  return {
    totalUsers,
    connectedCouples,
    newThisWeek,
    activeToday: activeTodaySet.size,
    activeThisWeek: activeThisWeekSet.size,
    notificationsOptedIn,
    usersWithPushSub,
    pwaInstalledCount,
    languageCounts,
    streakDistribution,
    milestonesTotal: allMilestones.length,
    milestonesByType,
    tempticoClicksTotal: allTempticoClicks.length,
    tempticoClicksBySource,
    gamesPlayedTotal: allGameRounds.length,
    gameRoundsBySlug,
    visitsBySource,
    signupsBySource,
    totals: {
      moods: allMoods.length,
      answers: allAnswers.length,
      completions: allCompletions.length,
      plannedDates: allPlanned.length,
      completedDates: allPlanned.filter((d: { completed: boolean }) => d.completed).length,
      datesWithPhotos: allPlanned.filter((d: { photo: string | null }) => !!d.photo).length,
      wishlistItems: allWishlist.length,
    },
    recentUsers,
  };
}

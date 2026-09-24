import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  doublePrecision,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------- Users ----------
export const users = pgTable("users", {
  id: varchar("id", { length: 24 }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  pin: text("pin"), // bcrypt hash of a 4-6 digit numeric PIN; never sent to clients
  connectCode: varchar("connect_code", { length: 8 }).notNull().unique(),
  partnerId: varchar("partner_id", { length: 24 }),
  anniversaryDate: text("anniversary_date"), // stored as YYYY-MM-DD
  birthday: text("birthday"), // YYYY-MM-DD; drives the partner's birthday reminders
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  reminderTime: text("reminder_time").notNull().default("random"),
  language: varchar("language", { length: 2 }).notNull().default("sl"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  pwaInstalledAt: timestamp("pwa_installed_at"), // set the first time the client detects standalone/installed mode
  source: text("source"), // acquisition source at registration, e.g. "paket" — see landingVisits below
});

// PIN_REGEX/pin are legacy — login moved to an emailed one-time code (see
// loginCodes below). The column and existing hashes are left in place
// (harmless, unused) rather than migrated away; nothing writes a pin for new
// accounts anymore.
export const PIN_REGEX = /^\d{4,6}$/;

export const insertUserSchema = createInsertSchema(users, {
  name: z.string().min(1, "Ime je obvezno"),
  email: z.string().email("Neveljaven e-poštni naslov"),
})
  .pick({ name: true, email: true })
  .extend({
    // Optional — the client sends whatever language the registration page is
    // currently showing (device-detected or explicitly chosen there), so the
    // welcome email and the rest of the app start in the right language from
    // the first screen rather than defaulting to Slovenian until the user
    // finds the switcher in Profile.
    language: z.enum(["sl", "en", "hr"]).optional(),
    // Optional — carried over from a tagged link/QR code (see landingVisits),
    // so the admin dashboard can show actual signups per acquisition channel,
    // not just raw landing visits.
    source: z.string().max(64).optional(),
  });

export const requestLoginCodeSchema = z.object({
  email: z.string().email("Neveljaven e-poštni naslov"),
});

export const CODE_REGEX = /^\d{6}$/;

export const verifyLoginCodeSchema = z.object({
  email: z.string().email("Neveljaven e-poštni naslov"),
  code: z.string().regex(CODE_REGEX, "Koda mora imeti 6 številk"),
});

// ---------- Login codes (one-time email codes, replace PIN login) ----------
export const loginCodes = pgTable("login_codes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  codeHash: text("code_hash").notNull(), // bcrypt, same helper as the old PIN hash
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // set once consumed, so a code can't be replayed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Moods ----------
export const moods = pgTable("moods", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  level: integer("level").notNull(), // 1-5
  note: text("note"),
  date: text("date").notNull(), // YYYY-MM-DD, one per user per day
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMoodSchema = createInsertSchema(moods, {
  level: z.number().min(1).max(5),
}).pick({ level: true, note: true });

// ---------- Daily Questions ----------
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(), // Slovenian, the fallback for any language
  textEn: text("text_en"),
  textHr: text("text_hr"),
  category: varchar("category", { length: 32 }).notNull(),
});

export const questionAnswers = pgTable("question_answers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  questionId: integer("question_id").notNull(),
  source: varchar("source", { length: 16 }).notNull().default("builtin"), // 'builtin' | 'custom'
  answer: text("answer").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnswerSchema = createInsertSchema(questionAnswers, {
  answer: z.string().min(1, "Odgovor ne sme biti prazen"),
}).pick({ answer: true });

// ---------- Challenges ----------
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(), // Slovenian, the fallback for any language
  textEn: text("text_en"),
  textHr: text("text_hr"),
  category: varchar("category", { length: 32 }).notNull(),
  difficulty: varchar("difficulty", { length: 16 }).notNull().default("easy"),
  active: boolean("active").notNull().default(true),
});

export const challengeCompletions = pgTable("challenge_completions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  challengeId: integer("challenge_id").notNull(),
  source: varchar("source", { length: 16 }).notNull().default("builtin"), // 'builtin' | 'custom'
  date: text("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(), // when the challenge was accepted
  completedAt: timestamp("completed_at"), // null until marked done — accepting is not completing
});

// ---------- Date ideas ----------
export const dateIdeas = pgTable("date_ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // Slovenian, the fallback for any language
  titleEn: text("title_en"),
  titleHr: text("title_hr"),
  description: text("description").notNull(),
  descriptionEn: text("description_en"),
  descriptionHr: text("description_hr"),
  category: varchar("category", { length: 24 }).notNull(), // doma, na-prostem, kulturno, aktivno, sprosceno
  cost: varchar("cost", { length: 16 }).notNull(), // brezplacno, eur, eur2, eur3
  duration: varchar("duration", { length: 24 }).notNull(), // 30min, 1h, 2h, 2h+
  locationType: varchar("location_type", { length: 32 }),
  city: text("city"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  tags: text("tags").array(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  externalId: text("external_id").unique(), // Google Places place_id, when sourced live
  custom: boolean("custom").notNull().default(false), // user-typed-in-app entry — never shown in the shared browsable catalog, only referenced by its own planned date
});

// ---------- Planned dates ----------
export const plannedDates = pgTable("planned_dates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  ideaId: integer("idea_id").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  notes: text("notes"),
  completed: boolean("completed").notNull().default(false),
  photo: text("photo"), // base64 data URL, added by either partner as a memory of the date
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlannedDateSchema = z.object({
  ideaId: z.number(),
  date: z.string().min(1, "Datum je obvezen"),
  time: z.string().min(1, "Ura je obvezna"),
  notes: z.string().optional(),
});

// ---------- Wishlist ----------
export const wishlistItems = pgTable("wishlist_items", {
  id: serial("id").primaryKey(),
  coupleKey: varchar("couple_key", { length: 49 }).notNull(),
  createdBy: varchar("created_by", { length: 24 }).notNull(),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWishlistItemSchema = z.object({
  text: z.string().min(2, "Prekratko").max(200, "Predolgo"),
});

// ---------- Reactions ----------
export const reactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  targetType: varchar("target_type", { length: 16 }).notNull(), // 'mood' | 'answer' | 'challenge'
  targetId: integer("target_id").notNull(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const REACTION_EMOJIS = ["❤️", "🥰", "😂", "🥺", "😢", "😲"] as const;

// The scheduler skips every tick outside 08:00–22:00 without touching the
// database (see FIRST/LAST_REMINDER_HOUR in scheduler.ts), so a time outside
// that range would silently never fire — widen both together.
export const REMINDER_TIMES = ["random", "08:00", "09:00", "10:00", "11:00", "12:00", "18:00", "19:00", "20:00", "21:00", "22:00"] as const;

// ---------- Custom questions & challenges ----------
export const customQuestions = pgTable("custom_questions", {
  id: serial("id").primaryKey(),
  coupleKey: varchar("couple_key", { length: 49 }).notNull(),
  createdBy: varchar("created_by", { length: 24 }).notNull(),
  text: text("text").notNull(),
  used: boolean("used").notNull().default(false),
  usedDate: text("used_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomQuestionSchema = z.object({
  text: z.string().min(3, "Vprašanje je prekratko").max(300, "Vprašanje je predolgo"),
});

export const customChallenges = pgTable("custom_challenges", {
  id: serial("id").primaryKey(),
  coupleKey: varchar("couple_key", { length: 49 }).notNull(),
  createdBy: varchar("created_by", { length: 24 }).notNull(),
  text: text("text").notNull(),
  used: boolean("used").notNull().default(false),
  usedDate: text("used_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomChallengeSchema = z.object({
  text: z.string().min(3, "Izziv je prekratek").max(300, "Izziv je predolg"),
});

// ---------- Daily assignments (couple-scoped question/challenge of the day) ----------
export const dailyAssignments = pgTable("daily_assignments", {
  id: serial("id").primaryKey(),
  coupleKey: varchar("couple_key", { length: 49 }).notNull(),
  date: text("date").notNull(),
  type: varchar("type", { length: 16 }).notNull(), // 'question' | 'challenge'
  itemId: integer("item_id").notNull(),
  source: varchar("source", { length: 16 }).notNull(), // 'builtin' | 'custom'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Reminder log (prevents duplicate scheduler pushes) ----------
export const reminderLog = pgTable("reminder_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  date: text("date").notNull(),
  type: text("type").notNull(), // 'daily' | 'streak_freeze' | 'anniversary' | 'date_reminder_3d_<plannedDateId>' | ... — was varchar(24), widened since per-row reminder types embed an id and can run long
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Milestones ----------
// Fires once per (user, type) — e.g. type "streak_30" — the moment a couple's
// streak first crosses a meaningful threshold. Surfaces as both a push
// notification and a dismissible celebration card on Home until the user
// dismisses it.
export const milestoneEvents = pgTable("milestone_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(), // e.g. 'streak_7', 'streak_30'
  value: integer("value").notNull(), // the raw number, e.g. 30 — kept alongside type so the UI doesn't need to parse it back out
  createdAt: timestamp("created_at").notNull().defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
});

// Click-through tracking for the Temptico CTAs (date-idea catalog entry,
// milestone celebration card) — Shopify's TOGETHER10 code usage shows
// completed purchases, but not how many people saw/clicked the offer
// without buying, so this fills that funnel gap.
export const TEMPTICO_CLICK_SOURCES = ["date_idea", "milestone"] as const;
export const tempticoClicks = pgTable("temptico_clicks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  source: varchar("source", { length: 16 }).notNull(), // 'date_idea' | 'milestone'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Acquisition tracking (QR codes, marketing links) ----------
// Records every landing visit that arrives tagged with ?src=, before we know
// whether the visitor ever registers — pairs with users.source above so the
// admin dashboard can show scans vs. actual signups per channel. `source` is
// free text rather than a fixed enum since a new QR/link gets tagged
// whenever one is made, without a code change.
export const landingVisits = pgTable("landing_visits", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trackVisitSchema = z.object({
  source: z.string().min(1, "Manjka vir").max(64, "Vir je predolg"),
});

// ---------- Feedback ----------
export const FEEDBACK_CATEGORIES = ["praise", "suggestion", "problem", "other"] as const;

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  category: varchar("category", { length: 16 }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedback, {
  category: z.enum(FEEDBACK_CATEGORIES),
  text: z.string().min(1, "Besedilo ne sme biti prazno").max(2000, "Besedilo je predolgo"),
}).pick({ category: true, text: true });

// ---------- Push subscriptions ----------
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPushSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// ---------- Games ----------
// The catalog itself (5 fixed games) is plain code, not a DB table — there's
// no admin need to add a 6th game without a deploy, and the English names
// are deliberately fixed regardless of app language ("Never Have I Ever" is
// how people know the game, in any language).
export const GAME_SLUGS = [
  "never-have-i-ever",
  "never-have-i-ever-spicy",
  "this-or-that",
  "would-you-rather",
  "know-your-partner",
] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];

export type GameFormat = "boolean" | "choice" | "text";

export const GAMES: Record<
  GameSlug,
  { name: string; emoji: string; format: GameFormat; adult?: boolean; gradient: string }
> = {
  "never-have-i-ever": { name: "Never Have I Ever", emoji: "🙊", format: "boolean", gradient: "from-indigo-500 to-purple-600" },
  "never-have-i-ever-spicy": {
    name: "Never Have I Ever",
    emoji: "🔥",
    format: "boolean",
    adult: true,
    gradient: "from-rose-600 to-red-700",
  },
  "this-or-that": { name: "This or That", emoji: "⚖️", format: "choice", gradient: "from-sky-500 to-blue-600" },
  "would-you-rather": { name: "Would You Rather", emoji: "🤔", format: "choice", gradient: "from-amber-500 to-orange-600" },
  "know-your-partner": { name: "Know Your Partner", emoji: "💞", format: "text", gradient: "from-pink-500 to-rose-600" },
};

// Prompt library — like questions/challenges, authored in Slovenian with
// optional EN/HR translations. "choice"-format games (this-or-that,
// would-you-rather) additionally carry two short option labels per
// language; boolean/text games leave those columns null.
export const gamePrompts = pgTable("game_prompts", {
  id: serial("id").primaryKey(),
  gameSlug: varchar("game_slug", { length: 32 }).notNull(),
  text: text("text").notNull(),
  textEn: text("text_en"),
  textHr: text("text_hr"),
  optionA: text("option_a"),
  optionAEn: text("option_a_en"),
  optionAHr: text("option_a_hr"),
  optionB: text("option_b"),
  optionBEn: text("option_b_en"),
  optionBHr: text("option_b_hr"),
});

// One deck of prompts a couple is (or was) playing through for a given
// game. Created once, by whichever partner starts the game first;
// `promptIds` is fixed at creation so both partners answer the exact same
// set. Reused (not recreated) while still open, so opening a game you
// already started, or one your partner started, resumes the same deck.
export const gameRounds = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  coupleKey: varchar("couple_key", { length: 49 }).notNull(),
  gameSlug: varchar("game_slug", { length: 32 }).notNull(),
  promptIds: text("prompt_ids").notNull(), // JSON-encoded number[]
  createdBy: varchar("created_by", { length: 24 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One partner's answer to one prompt within a round. A prompt is "revealed"
// (both answers visible) once a row exists here for both partners on the
// same (roundId, promptId).
export const gameRoundAnswers = pgTable("game_round_answers", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull(),
  promptId: integer("prompt_id").notNull(),
  userId: varchar("user_id", { length: 24 }).notNull(),
  answer: text("answer").notNull(), // "yes"/"no" (boolean), "A"/"B" (choice), free text (text)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const submitGameAnswerSchema = z.object({
  userId: z.string(),
  promptId: z.number(),
  answer: z.string().min(1, "Manjka odgovor").max(500, "Odgovor je predolg"),
});

// ---------- Types ----------
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Mood = typeof moods.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuestionAnswer = typeof questionAnswers.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type ChallengeCompletion = typeof challengeCompletions.$inferSelect;
export type DateIdea = typeof dateIdeas.$inferSelect;
export type PlannedDate = typeof plannedDates.$inferSelect;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;
export type CustomQuestion = typeof customQuestions.$inferSelect;
export type CustomChallenge = typeof customChallenges.$inferSelect;
export type DailyAssignment = typeof dailyAssignments.$inferSelect;
export type GamePrompt = typeof gamePrompts.$inferSelect;
export type GameRound = typeof gameRounds.$inferSelect;
export type GameRoundAnswer = typeof gameRoundAnswers.$inferSelect;

export const MOOD_LEVELS = [
  { level: 1, emoji: "😢", label: "Zelo slabo" },
  { level: 2, emoji: "😕", label: "Žalostno" },
  { level: 3, emoji: "😐", label: "V redu" },
  { level: 4, emoji: "😊", label: "Dobro" },
  { level: 5, emoji: "🥰", label: "Odlično" },
] as const;

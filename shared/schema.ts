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
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  reminderTime: text("reminder_time").notNull().default("random"),
  language: varchar("language", { length: 2 }).notNull().default("sl"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  pwaInstalledAt: timestamp("pwa_installed_at"), // set the first time the client detects standalone/installed mode
});

export const PIN_REGEX = /^\d{4,6}$/;

export const insertUserSchema = createInsertSchema(users, {
  name: z.string().min(1, "Ime je obvezno"),
  email: z.string().email("Neveljaven e-poštni naslov"),
})
  .pick({ name: true, email: true })
  .extend({ pin: z.string().regex(PIN_REGEX, "PIN mora imeti 4-6 številk") });

export const loginSchema = z.object({
  email: z.string().email("Neveljaven e-poštni naslov"),
  pin: z.string().regex(PIN_REGEX, "PIN mora imeti 4-6 številk"),
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
  title: text("title").notNull(),
  description: text("description").notNull(),
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

export const REACTION_EMOJIS = ["❤️", "🥰", "😂", "👏", "🔥", "🥺"] as const;

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
  type: varchar("type", { length: 24 }).notNull(), // 'daily' | 'streak_freeze' | 'anniversary'
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

export const MOOD_LEVELS = [
  { level: 1, emoji: "😢", label: "Zelo slabo" },
  { level: 2, emoji: "😕", label: "Žalostno" },
  { level: 3, emoji: "😐", label: "V redu" },
  { level: 4, emoji: "😊", label: "Dobro" },
  { level: 5, emoji: "🥰", label: "Odlično" },
] as const;

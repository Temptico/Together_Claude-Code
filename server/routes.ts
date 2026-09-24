import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as storage from "./storage.js";
import { getVapidPublicKey, notifyUser } from "./push.js";
import { sendWelcomeEmail, sendLoginCodeEmail } from "./email.js";
import {
  checkLoginIpLimit,
  checkRegisterIpLimit,
  checkRequestCodeIpLimit,
  checkRequestCodeEmailLimit,
  checkTrackVisitIpLimit,
  isEmailLockedOut,
  recordLoginFailure,
  clearLoginFailures,
} from "./rateLimit.js";
import { fetchNearbyPlaces } from "./places.js";
import { fetchNearbyOsmPlaces } from "./osmPlaces.js";
import {
  moodNotification,
  answerNotification,
  challengeNotification,
  reactionNotification,
  planDateNotification,
  photoAddedNotification,
  milestoneNotification,
  gameStartedNotification,
  gameCompletedNotification,
} from "./notificationText.js";
import {
  insertUserSchema,
  requestLoginCodeSchema,
  verifyLoginCodeSchema,
  trackVisitSchema,
  insertMoodSchema,
  insertAnswerSchema,
  insertPlannedDateSchema,
  insertCustomQuestionSchema,
  insertCustomChallengeSchema,
  insertWishlistItemSchema,
  insertFeedbackSchema,
  submitGameAnswerSchema,
  TEMPTICO_CLICK_SOURCES,
  REACTION_EMOJIS,
  REMINDER_TIMES,
  GAME_SLUGS,
  GAMES,
  type GameSlug,
  type GameRoundAnswer,
  type User,
} from "../shared/schema.js";

function ah(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

async function requireUser(req: Request, res: Response, id: string) {
  const user = await storage.getUserById(id);
  if (!user) {
    res.status(404).json({ error: "Uporabnik ne obstaja" });
    return null;
  }
  return user;
}

// Shared by both "plan a catalog idea" and "add your own date" — same date
// rules either way (valid, sane year, not in the past).
function parseScheduledAt(date: string, time: string): { scheduledAt: Date } | { error: string } {
  const scheduledAt = new Date(`${date}T${time}`);
  if (Number.isNaN(scheduledAt.getTime())) return { error: "Neveljaven datum ali ura" };
  const year = scheduledAt.getFullYear();
  if (year < 1900 || year > 9999) return { error: "Neveljavno leto" };
  const now = new Date();
  if (scheduledAt.getTime() < now.getTime() - 60_000) return { error: "Datum ne sme biti v preteklosti" };
  return { scheduledAt };
}

// Called after any activity that can move the streak (mood/answer/challenge
// completion). Cheap no-op the vast majority of the time — only does
// anything on the exact tick the streak lands on a round number. Errors are
// swallowed: a missed celebration is not worth failing the user's actual
// action over.
async function checkAndNotifyMilestone(user: { id: string }) {
  try {
    const milestone = await storage.checkStreakMilestone(user.id);
    if (!milestone) return;
    await notifyUser(user.id, (lang) => ({
      title: "Together",
      body: milestoneNotification(lang, milestone.value),
      tag: "milestone",
    }));
  } catch (err) {
    console.warn("[milestone] check failed for user", user.id, err);
  }
}

export function registerRoutes(app: Express) {
  // ---------------- Auth ----------------
  app.post(
    "/api/auth/register",
    ah(async (req, res) => {
      const { allowed, retryAfterSec } = checkRegisterIpLimit(req.ip || "unknown");
      if (!allowed) {
        res.status(429).set("Retry-After", String(retryAfterSec)).json({ error: "Preveč poskusov. Poskusi znova čez nekaj minut." });
        return;
      }
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        res.status(409).json({ error: "Ta e-poštni naslov je že v uporabi. Prosimo, prijavi se." });
        return;
      }
      const user = await storage.createUser(parsed.data.name, parsed.data.email, parsed.data.language, parsed.data.source);
      sendWelcomeEmail(user.email, user.name, user.language).catch(() => {});
      res.status(201).json(storage.omitPin(user));
    })
  );

  // Landing-visit tracking for tagged QR codes/links (e.g. the packaging
  // card) — fired once per page load from the client, before we know
  // whether the visitor registers. Pairs with the `source` recorded on the
  // user row at registration (see /api/auth/register above) so the admin
  // dashboard can show scans vs. actual signups per channel.
  app.post(
    "/api/track/visit",
    ah(async (req, res) => {
      const { allowed } = checkTrackVisitIpLimit(req.ip || "unknown");
      if (!allowed) {
        res.status(429).end();
        return;
      }
      const parsed = trackVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      await storage.recordLandingVisit(parsed.data.source);
      res.status(204).end();
    })
  );

  // Login is a one-time code emailed to the account, in two steps: request a
  // code, then verify it. Replaces the old PIN login — existing sessions
  // (userId already in the client's localStorage) are untouched by this,
  // since GET /api/auth/session/:id below never checked a PIN either way.
  app.post(
    "/api/auth/login/request-code",
    ah(async (req, res) => {
      const parsed = requestLoginCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }

      const ipLimit = checkRequestCodeIpLimit(req.ip || "unknown");
      if (!ipLimit.allowed) {
        res.status(429).set("Retry-After", String(ipLimit.retryAfterSec)).json({ error: "Preveč poskusov. Poskusi znova čez nekaj minut." });
        return;
      }
      const emailLimit = checkRequestCodeEmailLimit(parsed.data.email);
      if (!emailLimit.allowed) {
        res.status(429).set("Retry-After", String(emailLimit.retryAfterSec)).json({ error: "Preveč poskusov. Poskusi znova čez nekaj minut." });
        return;
      }

      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) {
        res.status(404).json({ error: "Računa s tem e-poštnim naslovom ne najdemo. Ustvari nov račun." });
        return;
      }

      const code = await storage.createLoginCode(user.id);
      if (!process.env.RESEND_API_KEY) console.log(`[dev] login code for ${user.email}: ${code}`);
      sendLoginCodeEmail(user.email, user.name, code, user.language).catch(() => {});
      res.json({ ok: true });
    })
  );

  app.post(
    "/api/auth/login/verify-code",
    ah(async (req, res) => {
      const parsed = verifyLoginCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }

      const ipLimit = checkLoginIpLimit(req.ip || "unknown");
      if (!ipLimit.allowed) {
        res.status(429).set("Retry-After", String(ipLimit.retryAfterSec)).json({ error: "Preveč poskusov. Poskusi znova čez nekaj minut." });
        return;
      }

      // Per-email lockout, independent of the IP limiter above — stops a
      // targeted brute-force of one account's 6-digit code even if the
      // attacker spreads attempts across IPs.
      const lockout = isEmailLockedOut(parsed.data.email);
      if (lockout.lockedOut) {
        res
          .status(429)
          .set("Retry-After", String(lockout.retryAfterSec))
          .json({ error: "Preveč neuspešnih poskusov za ta račun. Poskusi znova pozneje." });
        return;
      }

      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) {
        res.status(404).json({ error: "Računa s tem e-poštnim naslovom ne najdemo. Ustvari nov račun." });
        return;
      }

      const valid = await storage.verifyLoginCode(user.id, parsed.data.code);
      if (!valid) {
        recordLoginFailure(parsed.data.email);
        res.status(401).json({ error: "Napačna ali potekla koda" });
        return;
      }
      clearLoginFailures(parsed.data.email);
      res.json(storage.omitPin(user));
    })
  );

  app.get(
    "/api/auth/session/:id",
    ah(async (req, res) => {
      const user = await storage.getUserById(req.params.id);
      if (!user) {
        res.status(404).json({ error: "Uporabnik ne obstaja" });
        return;
      }
      res.json(storage.omitPin(user));
    })
  );

  // ---------------- Partner pairing ----------------
  app.post(
    "/api/partner/connect",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), code: z.string().min(8).max(8) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Koda mora imeti 8 znakov" });
        return;
      }
      const result = await storage.connectPartner(parsed.data.userId, parsed.data.code);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(storage.omitPin(result.partner));
    })
  );

  app.post(
    "/api/partner/disconnect",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      if (!user.partnerId) {
        res.status(400).json({ error: "Nimaš povezanega partnerja" });
        return;
      }
      const updated = await storage.disconnectPartner(user);
      res.json(storage.omitPin(updated));
    })
  );

  app.get(
    "/api/partner/invite-info/:code",
    ah(async (req, res) => {
      const user = await storage.getUserByConnectCode(req.params.code.toUpperCase());
      if (!user) {
        res.status(404).json({ error: "Povabilo ne obstaja" });
        return;
      }
      res.json({ name: user.name, code: user.connectCode });
    })
  );

  // ---------------- Home aggregate ----------------
  app.get(
    "/api/home/:userId",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.userId);
      if (!user) return;

      const date = storage.todayStr();
      const partner = user.partnerId ? await storage.getUserById(user.partnerId) : undefined;

      const [myMood, partnerMood, question, challenge, streak, upcomingDates, pendingMilestone] = await Promise.all([
        storage.getMoodForDate(user.id, date),
        partner ? storage.getMoodForDate(partner.id, date) : Promise.resolve(undefined),
        storage.resolveDailyQuestion(user, date),
        storage.resolveDailyChallenge(user, date),
        storage.calculateStreak(user.id),
        storage.getUpcomingPlannedDates(user, 3),
        storage.getPendingMilestone(user.id),
      ]);

      const myAnswer = question ? await storage.getAnswerForDate(user.id, question.id, date) : undefined;
      // challenge.date is the assignment's own date, not necessarily today —
      // a challenge rolled over from an earlier day (see resolveDailyChallenge)
      // has its completion stored under that original date.
      const completion = challenge ? await storage.getCompletionForDate(user.id, challenge.id, challenge.date) : undefined;

      const upcomingWithIdeas = await Promise.all(
        upcomingDates.map(async (d: any) => ({ ...d, idea: await storage.getDateIdeaById(d.ideaId, user.language) }))
      );

      const moodTargetIds = [myMood?.id, partnerMood?.id].filter((id): id is number => id != null);
      const moodReactions = await storage.getReactionsForTargets("mood", moodTargetIds);

      res.json({
        user: storage.omitPin(user),
        partner: partner ? storage.omitPin(partner) : null,
        streak,
        myMood: myMood ? { ...myMood, reactions: moodReactions.get(myMood.id) || [] } : null,
        partnerMood: partnerMood ? { ...partnerMood, reactions: moodReactions.get(partnerMood.id) || [] } : null,
        question: question || null,
        myAnswer: myAnswer || null,
        challenge: challenge || null,
        challengeAccepted: !!completion,
        challengeCompleted: !!completion?.completedAt,
        upcomingDates: upcomingWithIdeas,
        pendingMilestone: pendingMilestone || null,
      });
    })
  );

  // ---------------- Mood ----------------
  app.post(
    "/api/mood",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() }).and(insertMoodSchema);
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const date = storage.todayStr();
      const mood = await storage.createMood(user.id, parsed.data.level, parsed.data.note ?? undefined, date);

      if (user.partnerId) {
        notifyUser(user.partnerId, (lang) => ({
          title: "Together",
          body: moodNotification(lang, parsed.data.level),
          tag: "mood",
        })).catch(() => {});
      }
      checkAndNotifyMilestone(user).catch(() => {});
      res.status(201).json(mood);
    })
  );

  // ---------------- Daily question ----------------
  app.post(
    "/api/question/answer",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), questionId: z.number() }).and(insertAnswerSchema);
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const date = storage.todayStr();

      const todaysQuestion = await storage.resolveDailyQuestion(user, date);
      if (!todaysQuestion || todaysQuestion.id !== parsed.data.questionId) {
        res.status(400).json({ error: "Vprašanje ni več veljavno, osveži stran" });
        return;
      }

      const answer = await storage.createAnswer(
        user.id,
        parsed.data.questionId,
        parsed.data.answer,
        date,
        todaysQuestion.isCustom ? "custom" : "builtin"
      );

      if (user.partnerId) {
        notifyUser(user.partnerId, (lang) => ({
          title: "Together",
          body: answerNotification(lang),
          tag: "question",
        })).catch(() => {});
      }
      checkAndNotifyMilestone(user).catch(() => {});
      res.status(201).json(answer);
    })
  );

  // ---------------- Challenges ----------------
  app.post(
    "/api/challenge/accept",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), challengeId: z.number() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      // todaysChallenge.date is the assignment's own date — may be an
      // earlier day if the couple hasn't finished it yet (rollover).
      const todaysChallenge = await storage.resolveDailyChallenge(user, storage.todayStr());
      if (!todaysChallenge || todaysChallenge.id !== parsed.data.challengeId) {
        res.status(400).json({ error: "Izziv ni več veljaven, osveži stran" });
        return;
      }

      const acceptance = await storage.acceptChallenge(
        user.id,
        parsed.data.challengeId,
        todaysChallenge.date,
        todaysChallenge.isCustom ? "custom" : "builtin"
      );
      res.status(201).json(acceptance);
    })
  );

  app.post(
    "/api/challenge/complete",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), challengeId: z.number() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      // Same reasoning as accept above — complete against the challenge's
      // own assignment date, not always today.
      const todaysChallenge = await storage.resolveDailyChallenge(user, storage.todayStr());
      if (!todaysChallenge || todaysChallenge.id !== parsed.data.challengeId) {
        res.status(400).json({ error: "Izziv ni več veljaven, osveži stran" });
        return;
      }

      const completion = await storage.markChallengeCompleted(user.id, parsed.data.challengeId, todaysChallenge.date);
      if (!completion) {
        res.status(400).json({ error: "Izziv še ni sprejet" });
        return;
      }

      if (user.partnerId) {
        notifyUser(user.partnerId, (lang) => ({
          title: "Together",
          body: challengeNotification(lang),
          tag: "challenge",
        })).catch(() => {});
      }
      checkAndNotifyMilestone(user).catch(() => {});
      res.status(200).json(completion);
    })
  );

  app.patch(
    "/api/milestones/:id/dismiss",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Neveljaven mejnik" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      await storage.dismissMilestone(id, user.id);
      res.status(204).end();
    })
  );

  // ---------------- Date ideas ----------------
  app.get(
    "/api/dates/ideas",
    ah(async (req, res) => {
      const { category, duration, cost, lang } = req.query as Record<string, string | undefined>;
      const ideas = await storage.getDateIdeas({ category, duration, cost }, lang);
      res.json(ideas);
    })
  );

  app.get(
    "/api/dates/ideas/random",
    ah(async (req, res) => {
      const excludeId = req.query.exclude ? Number(req.query.exclude) : undefined;
      const lang = req.query.lang as string | undefined;
      const idea = await storage.getRandomDateIdea(excludeId, lang);
      if (!idea) {
        res.status(404).json({ error: "Ni idej za zmenek" });
        return;
      }
      res.json(idea);
    })
  );

  app.get(
    "/api/dates/nearby",
    ah(async (req, res) => {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        res.status(400).json({ error: "Manjka lokacija" });
        return;
      }
      const types = ((req.query.types as string) || "").split(",").filter(Boolean);
      const radiusKm = 5;
      const lang = req.query.lang as string | undefined;

      const localIdeas = await storage.getNearbyIdeas(lat, lng, types, radiusKm, lang);

      const withDistance = async (items: { lat: number; lng: number; externalId: string }[] | null) => {
        if (!items) return [] as any[];
        const upserted = await Promise.all(
          items.filter((r) => r.lat != null && r.lng != null).map((r) => storage.upsertExternalIdea(r as any))
        );
        return upserted
          .filter((idea): idea is NonNullable<typeof idea> => !!idea)
          .map((idea) => ({
            ...idea,
            distanceKm: Math.round(storage.haversineKm(lat, lng, idea.lat!, idea.lng!) * 10) / 10,
          }));
      };

      // OpenStreetMap needs no API key, so it's always attempted; Google Places
      // is an optional extra layer when GOOGLE_PLACES_API_KEY is configured.
      const [osmResults, googleResults] = await Promise.all([
        fetchNearbyOsmPlaces(lat, lng, types, radiusKm),
        fetchNearbyPlaces(lat, lng, types, radiusKm),
      ]);
      const [osmIdeas, googleIdeas] = await Promise.all([withDistance(osmResults), withDistance(googleResults)]);

      const byId = new Map<number, any>();
      for (const idea of [...localIdeas, ...osmIdeas, ...googleIdeas]) byId.set(idea.id, idea);
      const merged = [...byId.values()].sort((a, b) => a.distanceKm - b.distanceKm);

      // Both external lookups returning null (not just empty) means the search
      // itself failed (timeout, rate limit, network) — worth telling the user
      // apart from "there's genuinely nothing nearby".
      const searchFailed = osmResults === null && googleResults === null;

      res.json({ results: merged, searchFailed });
    })
  );

  // ---------------- Planned dates ----------------
  app.get(
    "/api/dates/planned/:userId",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.userId);
      if (!user) return;
      const rows = await storage.getPlannedDates(user);
      const withIdeas = await Promise.all(
        rows.map(async (d: any) => ({ ...d, idea: await storage.getDateIdeaById(d.ideaId, user.language) }))
      );
      res.json(withIdeas);
    })
  );

  app.post(
    "/api/dates/planned",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() }).and(insertPlannedDateSchema);
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      const parsedDate = parseScheduledAt(parsed.data.date, parsed.data.time);
      if ("error" in parsedDate) {
        res.status(400).json({ error: parsedDate.error });
        return;
      }

      const idea = await storage.getDateIdeaById(parsed.data.ideaId);
      if (!idea) {
        res.status(404).json({ error: "Ideja ne obstaja" });
        return;
      }

      const row = await storage.createPlannedDate(user.id, parsed.data.ideaId, parsedDate.scheduledAt, parsed.data.notes);

      if (user.partnerId) {
        notifyUser(user.partnerId, (lang) => ({
          title: "Together",
          body: planDateNotification(lang, idea.title),
          tag: "plan-date",
        })).catch(() => {});
      }

      res.status(201).json({ ...row, idea });
    })
  );

  // A date the couple typed in themselves, instead of picking from the
  // catalog — same downstream behavior (photo, completion, reminders) as a
  // catalog pick, see storage.createCustomPlannedDate.
  app.post(
    "/api/dates/planned/custom",
    ah(async (req, res) => {
      const schema = z.object({
        userId: z.string(),
        title: z.string().trim().min(1, "Naslov je obvezen").max(120, "Naslov je predolg"),
        description: z.string().trim().max(500, "Opis je predolg").optional(),
        date: z.string().min(1, "Datum je obvezen"),
        time: z.string().min(1, "Ura je obvezna"),
        notes: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      const parsedDate = parseScheduledAt(parsed.data.date, parsed.data.time);
      if ("error" in parsedDate) {
        res.status(400).json({ error: parsedDate.error });
        return;
      }

      const row = await storage.createCustomPlannedDate(
        user.id,
        parsed.data.title,
        parsed.data.description || "",
        parsedDate.scheduledAt,
        parsed.data.notes
      );

      if (user.partnerId) {
        notifyUser(user.partnerId, (lang) => ({
          title: "Together",
          body: planDateNotification(lang, row.idea.title),
          tag: "plan-date",
        })).catch(() => {});
      }

      res.status(201).json(row);
    })
  );

  app.patch(
    "/api/dates/planned/:id",
    ah(async (req, res) => {
      const schema = z.object({
        userId: z.string(),
        date: z.string().optional(),
        time: z.string().optional(),
        notes: z.string().optional(),
        completed: z.boolean().optional(),
        photo: z
          .string()
          .max(7_000_000, "Slika je prevelika")
          .regex(/^data:image\//, "Neveljavna slika")
          .nullable()
          .optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      const patch: any = {};
      if (parsed.data.date && parsed.data.time) {
        const scheduledAt = new Date(`${parsed.data.date}T${parsed.data.time}`);
        if (Number.isNaN(scheduledAt.getTime())) {
          res.status(400).json({ error: "Neveljaven datum ali ura" });
          return;
        }
        patch.scheduledAt = scheduledAt;
      }
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
      if (parsed.data.completed !== undefined) patch.completed = parsed.data.completed;
      if (parsed.data.photo !== undefined) patch.photo = parsed.data.photo;

      const row = await storage.updatePlannedDate(Number(req.params.id), user, patch);
      if (!row) {
        res.status(404).json({ error: "Zmenek ne obstaja" });
        return;
      }

      if (parsed.data.photo && user.partnerId) {
        const idea = await storage.getDateIdeaById(row.ideaId);
        notifyUser(user.partnerId, (lang) => ({
          title: "Together",
          body: photoAddedNotification(lang, (idea && storage.pickDateIdea(idea, lang).title) || ""),
          tag: "date-photo",
        })).catch(() => {});
      }

      res.json(row);
    })
  );

  app.delete(
    "/api/dates/planned/:id",
    ah(async (req, res) => {
      const userId = req.query.userId as string;
      if (!userId) {
        res.status(400).json({ error: "Manjka uporabnik" });
        return;
      }
      const user = await requireUser(req, res, userId);
      if (!user) return;
      await storage.deletePlannedDate(Number(req.params.id), user);
      res.status(204).end();
    })
  );

  // ---------------- Memories ----------------
  app.get(
    "/api/memories/:userId",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.userId);
      if (!user) return;
      const partner = user.partnerId ? await storage.getUserById(user.partnerId) : undefined;
      const stats = await storage.getStats(user.id);
      const ids = user.partnerId ? [user.id, user.partnerId] : [user.id];
      const [activity, pastDates, onThisDay, games] = await Promise.all([
        storage.getActivityTimeline(ids, 20),
        storage.getPastDatesTimeline(ids, 20),
        storage.getOnThisDayMemories(ids),
        storage.getCompletedGameRounds(user, 10),
      ]);
      const all = [...activity, ...pastDates, ...onThisDay];

      // enrich entries with question/challenge text where relevant
      const [questions, challenges, customQs, customChs] = await Promise.all([
        storage.getAllQuestions(),
        storage.getActiveChallenges(),
        storage.getCustomQuestions(user),
        storage.getCustomChallenges(user),
      ]);

      const reactionsByType = {
        mood: await storage.getReactionsForTargets(
          "mood",
          all.filter((e) => e.type === "mood").map((e) => e.detail.id)
        ),
        answer: await storage.getReactionsForTargets(
          "answer",
          all.filter((e) => e.type === "answer").map((e) => e.detail.id)
        ),
        challenge: await storage.getReactionsForTargets(
          "challenge",
          all.filter((e) => e.type === "challenge").map((e) => e.detail.id)
        ),
      };

      const enrich = (entry: (typeof all)[number]) => {
        const reactionList = (reactionsByType as any)[entry.type]?.get(entry.detail.id) || [];
        if (entry.type === "answer") {
          const isCustom = entry.detail.source === "custom";
          const q = isCustom
            ? customQs.find((c: any) => c.id === entry.detail.questionId)
            : questions.find((q: any) => q.id === entry.detail.questionId);
          const questionText = !q ? undefined : isCustom ? q.text : storage.pickLocalizedText(q, user.language);
          return { ...entry, questionText, reactions: reactionList };
        }
        if (entry.type === "challenge") {
          const isCustom = entry.detail.source === "custom";
          const c = isCustom
            ? customChs.find((c: any) => c.id === entry.detail.challengeId)
            : challenges.find((c: any) => c.id === entry.detail.challengeId);
          const challengeText = !c ? undefined : isCustom ? c.text : storage.pickLocalizedText(c, user.language);
          return { ...entry, challengeText, reactions: reactionList };
        }
        return { ...entry, reactions: reactionList };
      };

      res.json({
        stats,
        activity: activity.map(enrich),
        pastDates: pastDates.map(enrich),
        onThisDay: onThisDay.map(enrich),
        games,
        partnerName: partner?.name || null,
      });
    })
  );

  // ---------------- Profile ----------------
  app.patch(
    "/api/users/:id",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.id);
      if (!user) return;

      const schema = z.object({
        name: z.string().min(1, "Ime ne sme biti prazno").optional(),
        email: z.string().email("Neveljaven e-poštni naslov").optional(),
        anniversaryDate: z
          .string()
          .refine((v) => {
            const year = Number(v.slice(0, 4));
            return year >= 1900 && year <= 9999;
          }, "Neveljavno leto")
          .nullable()
          .optional(),
        notificationsEnabled: z.boolean().optional(),
        reminderTime: z.enum(REMINDER_TIMES).optional(),
        language: z.enum(["sl", "en", "hr"]).optional(),
        pwaInstalled: z.literal(true).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }

      if (parsed.data.email && parsed.data.email !== user.email) {
        const existing = await storage.getUserByEmail(parsed.data.email);
        if (existing) {
          res.status(409).json({ error: "Ta e-poštni naslov je že v uporabi" });
          return;
        }
      }

      const { pwaInstalled, ...rest } = parsed.data;
      const patch: any = { ...rest };
      // Only ever moves forward — never overwrite an existing install
      // timestamp with a later one from, say, a second device installing.
      if (pwaInstalled && !user.pwaInstalledAt) patch.pwaInstalledAt = new Date();

      // An empty patch (e.g. { pwaInstalled: true } sent again after the
      // timestamp is already set, with nothing else in the body) would
      // otherwise reach the DB as `UPDATE users SET WHERE ...` — invalid SQL.
      if (Object.keys(patch).length === 0) {
        res.json(storage.omitPin(user));
        return;
      }

      const updated = await storage.updateUser(user.id, patch);
      res.json(storage.omitPin(updated));
    })
  );

  app.delete(
    "/api/users/:id",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.id);
      if (!user) return;
      await storage.deleteUserAccount(user);
      res.status(204).end();
    })
  );

  // ---------------- Push ----------------
  app.get(
    "/api/push/vapid-public-key",
    ah(async (_req, res) => {
      res.json({ key: getVapidPublicKey() });
    })
  );

  app.post(
    "/api/push/subscribe",
    ah(async (req, res) => {
      const schema = z.object({
        userId: z.string(),
        subscription: z.object({
          endpoint: z.string(),
          keys: z.object({ p256dh: z.string(), auth: z.string() }),
        }),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      await storage.savePushSubscription(
        parsed.data.userId,
        parsed.data.subscription.endpoint,
        parsed.data.subscription.keys.p256dh,
        parsed.data.subscription.keys.auth
      );
      res.status(201).json({ ok: true });
    })
  );

  // ---------------- Reactions ----------------
  app.post(
    "/api/reactions",
    ah(async (req, res) => {
      const schema = z.object({
        userId: z.string(),
        targetType: z.enum(["mood", "answer", "challenge", "game_answer"]),
        targetId: z.number(),
        emoji: z.enum(REACTION_EMOJIS),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      const result = await storage.toggleReaction(
        user.id,
        parsed.data.targetType,
        parsed.data.targetId,
        parsed.data.emoji
      );

      if (result) {
        const owner = await storage.getTargetOwner(parsed.data.targetType, parsed.data.targetId);
        if (owner && owner !== user.id) {
          notifyUser(owner, (lang) => ({
            title: "Together",
            body: reactionNotification(lang, parsed.data.emoji),
            tag: "reaction",
          })).catch(() => {});
        }
      }

      res.status(201).json({ reaction: result });
    })
  );

  // ---------------- Games ----------------
  app.get(
    "/api/games/summary/:userId",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.userId);
      if (!user) return;
      const summary = await storage.getGamesSummary(user);
      res.json(summary);
    })
  );

  // The full deck for one round as the client renders it: localized prompts
  // in deck order, each with both partners' answers and reactions.
  async function gameDeckResponse(user: User, round: { id: number; gameSlug: string; promptIds: string }, isNew: boolean) {
    const gameSlug = round.gameSlug as GameSlug;
    const promptIds: number[] = JSON.parse(round.promptIds);
    const allPrompts = await storage.getGamePrompts(gameSlug);
    const promptById = new Map(allPrompts.map((p) => [p.id, p]));
    const answers = await storage.getGameRoundAnswers(round.id);
    const answerReactions = await storage.getReactionsForTargets(
      "game_answer",
      answers.map((a: GameRoundAnswer) => a.id)
    );

    const prompts = promptIds
      .map((pid) => promptById.get(pid))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => {
        const mine = answers.find((a: GameRoundAnswer) => a.promptId === p.id && a.userId === user.id);
        const partnerAnswer = user.partnerId
          ? answers.find((a: GameRoundAnswer) => a.promptId === p.id && a.userId === user.partnerId)
          : undefined;
        return {
          ...storage.localizeGamePrompt(p, user.language),
          myAnswer: mine?.answer ?? null,
          myAnswerId: mine?.id ?? null,
          myAnswerReactions: mine ? answerReactions.get(mine.id) || [] : [],
          partnerAnswer: partnerAnswer?.answer ?? null,
          partnerAnswerId: partnerAnswer?.id ?? null,
          partnerAnswerReactions: partnerAnswer ? answerReactions.get(partnerAnswer.id) || [] : [],
        };
      });

    return { roundId: round.id, gameSlug, isNew, prompts };
  }

  // Starts (or resumes) the couple's current deck for a game. Only notifies
  // the partner the first time a fresh deck is created, not on every resume.
  app.post(
    "/api/games/start",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), gameSlug: z.enum(GAME_SLUGS), newRound: z.boolean().optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      const gameSlug = parsed.data.gameSlug as GameSlug;
      const result = await storage.getOrCreateGameRound(user, gameSlug, parsed.data.newRound ?? false);
      if (!result) {
        res.status(404).json({ error: "Igra trenutno nima vprašanj" });
        return;
      }
      const { round, isNew } = result;

      if (isNew && user.partnerId) {
        notifyUser(user.partnerId, (lang) => ({
          title: "Together",
          body: gameStartedNotification(lang, GAMES[gameSlug].name),
          tag: `game-${round.id}`,
        })).catch(() => {});
      }

      res.json(await gameDeckResponse(user, round, isNew));
    })
  );

  // Reopens one specific round (e.g. a finished one from Memories) without
  // starting or resuming anything.
  app.post(
    "/api/games/round",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), roundId: z.number() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const round = await storage.getGameRoundForUser(user, parsed.data.roundId);
      if (!round) {
        res.status(404).json({ error: "Igra ne obstaja" });
        return;
      }
      res.json(await gameDeckResponse(user, round, false));
    })
  );

  app.post(
    "/api/games/answer",
    ah(async (req, res) => {
      const schema = submitGameAnswerSchema.extend({ roundId: z.number() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;

      await storage.submitGameRoundAnswer(parsed.data.roundId, user.id, parsed.data.promptId, parsed.data.answer);

      // If this was the last missing answer in the deck, let the partner
      // know the full comparison is ready — but only once per round.
      if (user.partnerId) {
        const round = await storage.getGameRoundById(parsed.data.roundId);
        if (round) {
          const promptIds: number[] = JSON.parse(round.promptIds);
          const answers = await storage.getGameRoundAnswers(round.id);
          const complete = promptIds.every(
            (pid) =>
              answers.some((a: GameRoundAnswer) => a.promptId === pid && a.userId === user.id) &&
              answers.some((a: GameRoundAnswer) => a.promptId === pid && a.userId === user.partnerId)
          );
          if (complete) {
            notifyUser(user.partnerId, (lang) => ({
              title: "Together",
              body: gameCompletedNotification(lang, GAMES[round.gameSlug as GameSlug].name),
              tag: `game-complete-${round.id}`,
            })).catch(() => {});
          }
        }
      }

      res.status(201).json({ ok: true });
    })
  );

  // ---------------- Custom questions ----------------
  app.get(
    "/api/custom-questions/:userId",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.userId);
      if (!user) return;
      const list = await storage.getCustomQuestions(user);
      res.json(list);
    })
  );

  app.post(
    "/api/custom-questions",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() }).and(insertCustomQuestionSchema);
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const row = await storage.createCustomQuestion(user, parsed.data.text);
      res.status(201).json(row);
    })
  );

  app.delete(
    "/api/custom-questions/:id",
    ah(async (req, res) => {
      const userId = req.query.userId as string;
      const user = await requireUser(req, res, userId);
      if (!user) return;
      await storage.deleteCustomQuestion(Number(req.params.id), user);
      res.status(204).end();
    })
  );

  // ---------------- Custom challenges ----------------
  app.get(
    "/api/custom-challenges/:userId",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.userId);
      if (!user) return;
      const list = await storage.getCustomChallenges(user);
      res.json(list);
    })
  );

  app.post(
    "/api/custom-challenges",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() }).and(insertCustomChallengeSchema);
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const row = await storage.createCustomChallenge(user, parsed.data.text);
      res.status(201).json(row);
    })
  );

  app.delete(
    "/api/custom-challenges/:id",
    ah(async (req, res) => {
      const userId = req.query.userId as string;
      const user = await requireUser(req, res, userId);
      if (!user) return;
      await storage.deleteCustomChallenge(Number(req.params.id), user);
      res.status(204).end();
    })
  );

  // ---------------- Wishlist ----------------
  app.get(
    "/api/wishlist/:userId",
    ah(async (req, res) => {
      const user = await requireUser(req, res, req.params.userId);
      if (!user) return;
      const items = await storage.getWishlist(user);
      res.json(items);
    })
  );

  app.post(
    "/api/wishlist",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() }).and(insertWishlistItemSchema);
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const item = await storage.createWishlistItem(user, parsed.data.text);
      res.status(201).json(item);
    })
  );

  app.patch(
    "/api/wishlist/:id",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), completed: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const item = await storage.updateWishlistItem(Number(req.params.id), user, parsed.data.completed);
      if (!item) {
        res.status(404).json({ error: "Ni najdeno" });
        return;
      }
      res.json(item);
    })
  );

  app.delete(
    "/api/wishlist/:id",
    ah(async (req, res) => {
      const userId = req.query.userId as string;
      const user = await requireUser(req, res, userId);
      if (!user) return;
      await storage.deleteWishlistItem(Number(req.params.id), user);
      res.status(204).end();
    })
  );

  // ---------------- Feedback ----------------
  app.post(
    "/api/feedback",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string() }).and(insertFeedbackSchema);
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      const row = await storage.createFeedback(user.id, parsed.data.category, parsed.data.text);
      res.status(201).json(row);
    })
  );

  // ---------------- Analytics ----------------
  app.post(
    "/api/track/temptico-click",
    ah(async (req, res) => {
      const schema = z.object({ userId: z.string(), source: z.enum(TEMPTICO_CLICK_SOURCES) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Neveljavni podatki" });
        return;
      }
      const user = await requireUser(req, res, parsed.data.userId);
      if (!user) return;
      await storage.recordTempticoClick(user.id, parsed.data.source);
      res.status(204).end();
    })
  );
}

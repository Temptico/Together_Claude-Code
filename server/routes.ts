import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as storage from "./storage.js";
import { getVapidPublicKey, notifyUser } from "./push.js";
import { fetchNearbyPlaces } from "./places.js";
import { fetchNearbyOsmPlaces } from "./osmPlaces.js";
import {
  moodNotification,
  answerNotification,
  challengeNotification,
  reactionNotification,
  planDateNotification,
  photoAddedNotification,
} from "./notificationText.js";
import {
  insertUserSchema,
  loginSchema,
  insertMoodSchema,
  insertAnswerSchema,
  insertPlannedDateSchema,
  insertCustomQuestionSchema,
  insertCustomChallengeSchema,
  insertWishlistItemSchema,
  REACTION_EMOJIS,
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

export function registerRoutes(app: Express) {
  // ---------------- Auth ----------------
  app.post(
    "/api/auth/register",
    ah(async (req, res) => {
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
      const pinHash = await storage.hashPin(parsed.data.pin);
      const user = await storage.createUser(parsed.data.name, parsed.data.email, pinHash);
      res.status(201).json(storage.omitPin(user));
    })
  );

  app.post(
    "/api/auth/login",
    ah(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) {
        res.status(404).json({ error: "Računa s tem e-poštnim naslovom ne najdemo. Ustvari nov račun." });
        return;
      }

      // TEMPORARY: set DISABLE_PIN_CHECK=1 in Render to let any known email
      // log in regardless of PIN, for testing. Remove the env var to restore
      // normal PIN verification — no code change needed either way.
      if (process.env.DISABLE_PIN_CHECK === "1") {
        res.json(storage.omitPin(user));
        return;
      }

      if (!user.pin) {
        // Legacy account created before PINs existed: the first PIN entered
        // on login claims the account going forward, rather than locking
        // anyone out.
        const pinHash = await storage.hashPin(parsed.data.pin);
        const updated = await storage.updateUser(user.id, { pin: pinHash });
        res.json(storage.omitPin(updated));
        return;
      }

      const valid = await storage.verifyPin(parsed.data.pin, user.pin);
      if (!valid) {
        res.status(401).json({ error: "Napačen PIN" });
        return;
      }
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

      const [myMood, partnerMood, question, challenge, streak, upcomingDates] = await Promise.all([
        storage.getMoodForDate(user.id, date),
        partner ? storage.getMoodForDate(partner.id, date) : Promise.resolve(undefined),
        storage.resolveDailyQuestion(user, date),
        storage.resolveDailyChallenge(user, date),
        storage.calculateStreak(user.id),
        storage.getUpcomingPlannedDates(user, 3),
      ]);

      const myAnswer = question ? await storage.getAnswerForDate(user.id, question.id, date) : undefined;
      const completion = challenge ? await storage.getCompletionForDate(user.id, challenge.id, date) : undefined;

      const upcomingWithIdeas = await Promise.all(
        upcomingDates.map(async (d: any) => ({ ...d, idea: await storage.getDateIdeaById(d.ideaId) }))
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
      const date = storage.todayStr();

      const todaysChallenge = await storage.resolveDailyChallenge(user, date);
      if (!todaysChallenge || todaysChallenge.id !== parsed.data.challengeId) {
        res.status(400).json({ error: "Izziv ni več veljaven, osveži stran" });
        return;
      }

      const acceptance = await storage.acceptChallenge(
        user.id,
        parsed.data.challengeId,
        date,
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
      const date = storage.todayStr();

      const completion = await storage.markChallengeCompleted(user.id, parsed.data.challengeId, date);
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
      res.status(200).json(completion);
    })
  );

  // ---------------- Date ideas ----------------
  app.get(
    "/api/dates/ideas",
    ah(async (req, res) => {
      const { category, duration, cost } = req.query as Record<string, string | undefined>;
      const ideas = await storage.getDateIdeas({ category, duration, cost });
      res.json(ideas);
    })
  );

  app.get(
    "/api/dates/ideas/random",
    ah(async (req, res) => {
      const excludeId = req.query.exclude ? Number(req.query.exclude) : undefined;
      const idea = await storage.getRandomDateIdea(excludeId);
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

      const localIdeas = await storage.getNearbyIdeas(lat, lng, types, radiusKm);

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
        rows.map(async (d: any) => ({ ...d, idea: await storage.getDateIdeaById(d.ideaId) }))
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

      const scheduledAt = new Date(`${parsed.data.date}T${parsed.data.time}`);
      if (Number.isNaN(scheduledAt.getTime())) {
        res.status(400).json({ error: "Neveljaven datum ali ura" });
        return;
      }
      const year = scheduledAt.getFullYear();
      if (year < 1900 || year > 9999) {
        res.status(400).json({ error: "Neveljavno leto" });
        return;
      }
      const now = new Date();
      if (scheduledAt.getTime() < now.getTime() - 60_000) {
        res.status(400).json({ error: "Datum ne sme biti v preteklosti" });
        return;
      }

      const idea = await storage.getDateIdeaById(parsed.data.ideaId);
      if (!idea) {
        res.status(404).json({ error: "Ideja ne obstaja" });
        return;
      }

      const row = await storage.createPlannedDate(user.id, parsed.data.ideaId, scheduledAt, parsed.data.notes);

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
          body: photoAddedNotification(lang, idea?.title || ""),
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
      const [timeline, onThisDay] = await Promise.all([
        storage.getTimeline(ids, 20),
        storage.getOnThisDayMemories(ids),
      ]);
      const all = [...timeline, ...onThisDay];

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
        timeline: timeline.map(enrich),
        onThisDay: onThisDay.map(enrich),
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
        reminderTime: z.string().optional(),
        language: z.enum(["sl", "en", "hr"]).optional(),
        pin: z.string().regex(/^\d{4,6}$/, "PIN mora imeti 4-6 številk").optional(),
        currentPin: z.string().optional(),
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

      const { currentPin, pin, ...rest } = parsed.data;
      const patch: any = { ...rest };

      if (pin) {
        if (user.pin) {
          if (!currentPin || !(await storage.verifyPin(currentPin, user.pin))) {
            res.status(401).json({ error: "Napačen trenutni PIN" });
            return;
          }
        }
        patch.pin = await storage.hashPin(pin);
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
        targetType: z.enum(["mood", "answer", "challenge"]),
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
}

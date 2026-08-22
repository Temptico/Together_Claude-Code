import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as storage from "./storage.js";
import { getVapidPublicKey, notifyUser } from "./push.js";
import { fetchNearbyPlaces } from "./places.js";
import { fetchNearbyOsmPlaces } from "./osmPlaces.js";
import {
  insertUserSchema,
  insertMoodSchema,
  insertAnswerSchema,
  insertPlannedDateSchema,
  insertCustomQuestionSchema,
  insertCustomChallengeSchema,
  REACTION_EMOJIS,
} from "../shared/schema.js";

function ah(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

function computeAnniversaryCountdown(anniversaryDate: string) {
  const anniv = new Date(anniversaryDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), anniv.getMonth(), anniv.getDate());
  if (next.getTime() < today.getTime()) next = new Date(now.getFullYear() + 1, anniv.getMonth(), anniv.getDate());
  const daysUntil = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isToday = daysUntil === 0;
  const years = next.getFullYear() - anniv.getFullYear();
  return { daysUntil, isToday, years };
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
      const user = await storage.createUser(parsed.data.name, parsed.data.email);
      res.status(201).json(user);
    })
  );

  app.post(
    "/api/auth/login",
    ah(async (req, res) => {
      const schema = z.object({ email: z.string().email("Neveljaven e-poštni naslov") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Neveljavni podatki" });
        return;
      }
      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) {
        res.status(404).json({ error: "Računa s tem e-poštnim naslovom ne najdemo. Ustvari nov račun." });
        return;
      }
      res.json(user);
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
      res.json(user);
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
      res.json(result.partner);
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

      const anniversaryCountdown = user.anniversaryDate ? computeAnniversaryCountdown(user.anniversaryDate) : null;

      res.json({
        user,
        partner: partner || null,
        streak,
        myMood: myMood ? { ...myMood, reactions: moodReactions.get(myMood.id) || [] } : null,
        partnerMood: partnerMood ? { ...partnerMood, reactions: moodReactions.get(partnerMood.id) || [] } : null,
        question: question || null,
        myAnswer: myAnswer || null,
        challenge: challenge || null,
        challengeCompleted: !!completion,
        upcomingDates: upcomingWithIdeas,
        anniversaryCountdown,
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
        const moodLabels: Record<number, string> = {
          1: "zelo slabo",
          2: "žalostno",
          3: "v redu",
          4: "dobro",
          5: "odlično",
        };
        notifyUser(user.partnerId, {
          title: "Together",
          body: `Tvoj partner se danes počuti ${moodLabels[parsed.data.level] || ""}! 🌟`,
          tag: "mood",
        }).catch(() => {});
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
        notifyUser(user.partnerId, {
          title: "Together",
          body: "Partner je odgovoril na današnje vprašanje. Preveri odgovor.",
          tag: "question",
        }).catch(() => {});
      }
      res.status(201).json(answer);
    })
  );

  // ---------------- Challenges ----------------
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

      const todaysChallenge = await storage.resolveDailyChallenge(user, date);
      if (!todaysChallenge || todaysChallenge.id !== parsed.data.challengeId) {
        res.status(400).json({ error: "Izziv ni več veljaven, osveži stran" });
        return;
      }

      const completion = await storage.completeChallenge(
        user.id,
        parsed.data.challengeId,
        date,
        todaysChallenge.isCustom ? "custom" : "builtin"
      );

      if (user.partnerId) {
        notifyUser(user.partnerId, {
          title: "Together",
          body: "Partner je dokončal današnji izziv! 🏆",
          tag: "challenge",
        }).catch(() => {});
      }
      res.status(201).json(completion);
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

      res.json(merged);
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
      const stats = await storage.getStats(user.id);
      const ids = user.partnerId ? [user.id, user.partnerId] : [user.id];
      const timeline = await storage.getTimeline(ids, 20);

      // enrich timeline entries with question/challenge text where relevant
      const [questions, challenges, customQs, customChs] = await Promise.all([
        storage.getAllQuestions(),
        storage.getActiveChallenges(),
        storage.getCustomQuestions(user),
        storage.getCustomChallenges(user),
      ]);

      const reactionsByType = {
        mood: await storage.getReactionsForTargets(
          "mood",
          timeline.filter((e) => e.type === "mood").map((e) => e.detail.id)
        ),
        answer: await storage.getReactionsForTargets(
          "answer",
          timeline.filter((e) => e.type === "answer").map((e) => e.detail.id)
        ),
        challenge: await storage.getReactionsForTargets(
          "challenge",
          timeline.filter((e) => e.type === "challenge").map((e) => e.detail.id)
        ),
      };

      const enriched = timeline.map((entry) => {
        const reactionList = reactionsByType[entry.type].get(entry.detail.id) || [];
        if (entry.type === "answer") {
          const isCustom = entry.detail.source === "custom";
          const q = isCustom
            ? customQs.find((c: any) => c.id === entry.detail.questionId)
            : questions.find((q: any) => q.id === entry.detail.questionId);
          return { ...entry, questionText: q?.text, reactions: reactionList };
        }
        if (entry.type === "challenge") {
          const isCustom = entry.detail.source === "custom";
          const c = isCustom
            ? customChs.find((c: any) => c.id === entry.detail.challengeId)
            : challenges.find((c: any) => c.id === entry.detail.challengeId);
          return { ...entry, challengeText: c?.text, reactions: reactionList };
        }
        return { ...entry, reactions: reactionList };
      });

      res.json({ stats, timeline: enriched });
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

      const updated = await storage.updateUser(user.id, parsed.data as any);
      res.json(updated);
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
          notifyUser(owner, {
            title: "Together",
            body: `Partner se je odzval/a z ${parsed.data.emoji}`,
            tag: "reaction",
          }).catch(() => {});
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
}

// Advent calendar: 24 daily windows, 1–24 December.
//
// Season (local time, Europe/Ljubljana):
//  - 25 Nov – 24 Dec: the invite is shown to couples who haven't joined.
//  - 1 – 24 Dec: window N opens on day N; earlier windows stay open.
//  - until 31 Dec: joined couples can still catch up and see their reward.
// A couple takes part once either partner joins; progress is the union of
// both partners' completed days, so it survives either one doing the task.
// ADVENT_GOAL completed days earn one single-use code from the pool.

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db.js";
import {
  adventCompletions,
  adventDays,
  adventParticipants,
  adventRewardCodes,
  ADVENT_GOAL,
  type AdventType,
  type User,
} from "../shared/schema.js";

export type AdventPhase = "off" | "invite" | "active" | "catchup";

// The current date for the calendar. ADVENT_TODAY (YYYY-MM-DD) fakes it
// outside production, so the calendar can be tried in November.
export function adventNow(): Date {
  const fake = process.env.NODE_ENV !== "production" ? process.env.ADVENT_TODAY : undefined;
  if (fake && /^\d{4}-\d{2}-\d{2}$/.test(fake)) {
    const [y, m, d] = fake.split("-").map(Number);
    const now = new Date();
    return new Date(y, m - 1, d, now.getHours(), now.getMinutes());
  }
  return new Date();
}

export function adventSeason(now: Date = adventNow()): { year: number; phase: AdventPhase; today: number } {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const date = now.getDate();
  if (month === 10 && date >= 25) return { year, phase: "invite", today: 0 };
  if (month === 11 && date <= 24) return { year, phase: "active", today: date };
  if (month === 11) return { year, phase: "catchup", today: 24 };
  return { year, phase: "off", today: 0 };
}

// ---------------- Default content ----------------
// Inserted only for days that don't exist yet: once a day is edited in
// /admin/advent, the database is the source of truth.
const SHOP = "https://www.temptico.com";
const OFFER = { sl: `${SHOP}/collections/all`, en: `${SHOP}/en/collections/all`, hr: `${SHOP}/hr-hr/collections/all` };

type DefaultDay = { day: number; type: AdventType; sl: [string, string]; en: [string, string]; hr: [string, string] };

const DEFAULT_DAYS: DefaultDay[] = [
  { day: 1, type: "task",
    sl: ["Najljubši spomin", "Povejta si, kateri skupni spomin iz tega leta vama je najljubši."],
    en: ["Favorite memory", "Tell each other your favorite shared memory from this year."],
    hr: ["Najdraža uspomena", "Recite si koja vam je najdraža zajednička uspomena iz ove godine."] },
  { day: 2, type: "task",
    sl: ["Večerja brez telefonov", "Nocoj večerja brez telefonov."],
    en: ["Phone-free dinner", "Tonight, dinner without phones."],
    hr: ["Večera bez mobitela", "Večeras večera bez mobitela."] },
  { day: 3, type: "question",
    sl: ["Pogosteje, prosim", "Kaj bi vsak od vaju rad, da drugi pogosteje naredi?"],
    en: ["More often, please", "What would each of you like the other to do more often?"],
    hr: ["Češće, molim", "Što bi svatko od vas želio da drugi češće radi?"] },
  { day: 4, type: "task",
    sl: ["Skrito sporočilo", "Napišita si kratko sporočilo in ga skrijta, da ga drugi najde."],
    en: ["Hidden note", "Write each other a short note and hide it for the other to find."],
    hr: ["Skrivena poruka", "Napišite si kratku poruku i sakrijte je da je drugi pronađe."] },
  { day: 5, type: "task",
    sl: ["Filmski večer", "Skupaj izberita film, ki ga eden od vaju še ni videl."],
    en: ["Movie night", "Pick a film together that one of you hasn't seen yet."],
    hr: ["Filmska večer", "Zajedno odaberite film koji jedno od vas još nije gledalo."] },
  { day: 6, type: "temptico",
    sl: ["Miklavževo presenečenje", "Pripravi drobno darilo za partnerja in ga skrij, da ga najde zjutraj."],
    en: ["St. Nicholas surprise", "Prepare a small gift for your partner and hide it for them to find in the morning."],
    hr: ["Iznenađenje za Svetog Nikolu", "Pripremi mali dar za partnera i sakrij ga da ga pronađe ujutro."] },
  { day: 7, type: "question",
    sl: ["Brez omejitev", "Kje bi bila čez pet let, če ne bi bilo nobenih omejitev?"],
    en: ["No limits", "Where would you be in five years if there were no limits at all?"],
    hr: ["Bez ograničenja", "Gdje biste bili za pet godina da nema nikakvih ograničenja?"] },
  { day: 8, type: "task",
    sl: ["Nekaj novega v kuhinji", "Kuhajta skupaj nekaj, česar še nista nikoli."],
    en: ["Something new in the kitchen", "Cook something together that you've never made before."],
    hr: ["Nešto novo u kuhinji", "Skuhajte zajedno nešto što još nikad niste."] },
  { day: 9, type: "question",
    sl: ["Letošnje presenečenje", "Kateri trenutek letos te je pri meni najbolj presenetil?"],
    en: ["This year's surprise", "Which moment this year did I surprise you the most?"],
    hr: ["Ovogodišnje iznenađenje", "Kojim sam te trenutkom ove godine najviše iznenadio/la?"] },
  { day: 10, type: "task",
    sl: ["Lov na lučke", "Pojdita na večerni sprehod in poiščita najlepše okrašeno okno ali ulico."],
    en: ["Light hunt", "Go for an evening walk and find the most beautifully decorated window or street."],
    hr: ["Lov na lampice", "Prošećite navečer i pronađite najljepše ukrašen prozor ili ulicu."] },
  { day: 11, type: "question",
    sl: ["Praznična navada", "Katera praznična navada iz otroštva ti je najljubša in bi jo rad/a imel/a tudi pri naju?"],
    en: ["Holiday tradition", "Which holiday tradition from your childhood do you love most, and would you like us to keep it too?"],
    hr: ["Blagdanski običaj", "Koji ti je blagdanski običaj iz djetinjstva najdraži i bi li ga želio/željela imati i kod nas?"] },
  { day: 12, type: "task",
    sl: ["Tri zahvale", "Vsak napiše tri stvari, za katere je drugemu letos hvaležen. Preberita jih na glas."],
    en: ["Three thank-yous", "Each write down three things you're grateful to the other for this year. Read them out loud."],
    hr: ["Tri zahvale", "Svatko napiše tri stvari na kojima je drugome ove godine zahvalan. Pročitajte ih naglas."] },
  { day: 13, type: "temptico",
    sl: ["Večer pri svečah", "Ugasnita luči, prižgita sveče in si vzemita uro samo zase."],
    en: ["Candlelit evening", "Switch off the lights, light some candles and take an hour just for the two of you."],
    hr: ["Večer uz svijeće", "Ugasite svjetla, upalite svijeće i uzmite sat vremena samo za sebe."] },
  { day: 14, type: "task",
    sl: ["Naša voščilnica", "Naredita skupno fotografijo, ki bo vajina letošnja praznična voščilnica."],
    en: ["Our holiday card", "Take a photo together that will be your holiday card this year."],
    hr: ["Naša čestitka", "Snimite zajedničku fotografiju koja će biti vaša ovogodišnja blagdanska čestitka."] },
  { day: 15, type: "question",
    sl: ["Letošnja lekcija", "Česa si se letos naučil/a o sebi – ali o naju?"],
    en: ["This year's lesson", "What did you learn this year about yourself – or about us?"],
    hr: ["Ovogodišnja lekcija", "Što si ove godine naučio/la o sebi – ili o nama?"] },
  { day: 16, type: "task",
    sl: ["Praznični seznam pesmi", "Skupaj sestavita seznam pesmi za praznične večere. Vsak doda pet."],
    en: ["Holiday playlist", "Make a playlist for holiday evenings together. Each of you adds five songs."],
    hr: ["Blagdanska playlista", "Zajedno složite playlistu za blagdanske večeri. Svatko doda pet pjesama."] },
  { day: 17, type: "question",
    sl: ["Popoln zimski dan", "Kakšen bi bil zate popoln zimski dan v dvoje, od jutra do večera?"],
    en: ["Perfect winter day", "What would a perfect winter day for two look like to you, from morning to night?"],
    hr: ["Savršen zimski dan", "Kako bi za tebe izgledao savršen zimski dan u dvoje, od jutra do večeri?"] },
  { day: 18, type: "task",
    sl: ["Deset minut nežnosti", "Izmenjajta si masažo rok ali ramen, vsak po deset minut."],
    en: ["Ten minutes of care", "Give each other a hand or shoulder massage, ten minutes each."],
    hr: ["Deset minuta nježnosti", "Izmijenite masažu ruku ili ramena, svatko po deset minuta."] },
  { day: 19, type: "question",
    sl: ["Neizrečena želja", "Katero željo za prihodnje leto si še nisi upal/a povedati na glas?"],
    en: ["Unspoken wish", "Which wish for next year haven't you dared to say out loud yet?"],
    hr: ["Neizrečena želja", "Koju želju za sljedeću godinu još se nisi usudio/la izgovoriti naglas?"] },
  { day: 20, type: "temptico",
    sl: ["Restavracija doma", "Pogrnita mizo kot v restavraciji, z glasbo in nečim sladkim za konec."],
    en: ["Restaurant at home", "Set the table like a restaurant, with music and something sweet to finish."],
    hr: ["Restoran kod kuće", "Postavite stol kao u restoranu, uz glazbu i nešto slatko za kraj."] },
  { day: 21, type: "task",
    sl: ["Najdaljša noč", "Ugasnita zaslone in se pogovarjajta, dokler vama ne zmanjka besed ali sveč."],
    en: ["The longest night", "Switch off the screens and talk until you run out of words – or candles."],
    hr: ["Najduža noć", "Ugasite ekrane i razgovarajte dok vam ne ponestane riječi – ili svijeća."] },
  { day: 22, type: "question",
    sl: ["Letos drugače", "Kaj si želiš, da bi letos za praznike naredila drugače kot lani?"],
    en: ["Different this year", "What would you like us to do differently this holiday season than last year?"],
    hr: ["Ove godine drugačije", "Što bi želio/željela da ove blagdane napravimo drugačije nego prošle godine?"] },
  { day: 23, type: "temptico",
    sl: ["Darilo pred darili", "Podarita si nekaj majhnega, kar bo postalo vajin praznični ritual vsako leto."],
    en: ["A gift before the gifts", "Give each other something small that becomes your holiday ritual every year."],
    hr: ["Dar prije darova", "Poklonite si nešto malo što će postati vaš blagdanski ritual svake godine."] },
  { day: 24, type: "task",
    sl: ["Pismo za prihodnje leto", "Napišita si pismo za naslednji božič, zaprita ga v kuverto in ga odprita čez eno leto."],
    en: ["A letter for next year", "Write each other a letter for next Christmas, seal it in an envelope and open it in a year."],
    hr: ["Pismo za sljedeću godinu", "Napišite si pismo za sljedeći Božić, zatvorite ga u omotnicu i otvorite za godinu dana."] },
];

export async function seedAdventDays() {
  const rows = DEFAULT_DAYS.map((d) => ({
    day: d.day,
    type: d.type,
    title: d.sl[0],
    titleEn: d.en[0],
    titleHr: d.hr[0],
    text: d.sl[1],
    textEn: d.en[1],
    textHr: d.hr[1],
    offerUrl: d.type === "temptico" ? OFFER.sl : null,
    offerUrlEn: d.type === "temptico" ? OFFER.en : null,
    offerUrlHr: d.type === "temptico" ? OFFER.hr : null,
  }));
  await db.insert(adventDays).values(rows).onConflictDoNothing();
}

// ---------------- Reads ----------------
type DayRow = typeof adventDays.$inferSelect;

function pick(lang: string, sl: string | null, en: string | null, hr: string | null): string | null {
  if (lang === "en") return en || sl;
  if (lang === "hr") return hr || sl;
  return sl;
}

// UTM tags so the shop's analytics can tell advent traffic apart per day.
export function withUtm(url: string, day: number): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "together");
    u.searchParams.set("utm_medium", "app");
    u.searchParams.set("utm_campaign", "advent");
    u.searchParams.set("utm_content", `day-${day}`);
    return u.toString();
  } catch {
    return url;
  }
}

export async function getAdventDays(): Promise<DayRow[]> {
  return db.select().from(adventDays).orderBy(adventDays.day);
}

function coupleIds(user: User): string[] {
  return user.partnerId ? [user.id, user.partnerId] : [user.id];
}

export async function getAdventState(user: User, lang: string) {
  const { year, phase, today } = adventSeason();
  const ids = coupleIds(user);

  const [participants, completions, rewards, days] = await Promise.all([
    db.select().from(adventParticipants).where(and(inArray(adventParticipants.userId, ids), eq(adventParticipants.year, year))),
    db.select().from(adventCompletions).where(and(inArray(adventCompletions.userId, ids), eq(adventCompletions.year, year))),
    db.select().from(adventRewardCodes).where(and(inArray(adventRewardCodes.userId, ids), eq(adventRewardCodes.year, year))),
    getAdventDays(),
  ]);

  const joined = participants.length > 0;
  const completedDays = [...new Set<number>(completions.map((c: { day: number }) => c.day))].sort((a, b) => a - b);

  return {
    year,
    phase,
    today,
    joined,
    goal: ADVENT_GOAL,
    completedCount: completedDays.length,
    needsConsent: !user.marketingConsent,
    reward: rewards[0] ? { code: rewards[0].code as string } : null,
    // Content only for couples who joined, and only for windows already open.
    days: days.map((d: DayRow) => {
      const open = joined && phase !== "invite" && phase !== "off" && d.day <= today;
      const base = { day: d.day, type: d.type as AdventType, open, completed: completedDays.includes(d.day) };
      if (!open) return base;
      const url = pick(lang, d.offerUrl, d.offerUrlEn, d.offerUrlHr);
      return {
        ...base,
        title: pick(lang, d.title, d.titleEn, d.titleHr)!,
        text: pick(lang, d.text, d.textEn, d.textHr)!,
        offerUrl: d.type === "temptico" && url ? withUtm(url, d.day) : null,
      };
    }),
  };
}

// ---------------- Writes ----------------
export async function joinAdvent(user: User) {
  const { year } = adventSeason();
  await db.insert(adventParticipants).values({ userId: user.id, year }).onConflictDoNothing();
}

export async function isCoupleJoined(user: User, year: number): Promise<boolean> {
  const rows = await db
    .select({ id: adventParticipants.id })
    .from(adventParticipants)
    .where(and(inArray(adventParticipants.userId, coupleIds(user)), eq(adventParticipants.year, year)));
  return rows.length > 0;
}

export async function completeAdventDay(user: User, day: number) {
  const { year } = adventSeason();
  await db.insert(adventCompletions).values({ userId: user.id, year, day }).onConflictDoNothing();
}

// Hands the couple one code once they reach the goal. Safe to call any
// number of times: a couple already holding a code gets nothing new, and
// the code is claimed with a conditional UPDATE, so two partners finishing
// at the same moment can't both take one. Returns the newly assigned code
// (to email it), or null when nothing was assigned now.
export async function ensureAdventReward(user: User): Promise<string | null> {
  const { year } = adventSeason();
  const ids = coupleIds(user);
  const completions = await db
    .select({ day: adventCompletions.day })
    .from(adventCompletions)
    .where(and(inArray(adventCompletions.userId, ids), eq(adventCompletions.year, year)));
  if (new Set(completions.map((c: { day: number }) => c.day)).size < ADVENT_GOAL) return null;

  // Serialize per couple: the lowest id of the pair takes the claim marker.
  const claimer = [...ids].sort()[0];
  const existing = await db
    .select()
    .from(adventRewardCodes)
    .where(and(inArray(adventRewardCodes.userId, ids), eq(adventRewardCodes.year, year)));
  if (existing.length > 0) return null;

  const [assigned] = await db
    .update(adventRewardCodes)
    .set({ userId: claimer, assignedAt: new Date() })
    .where(
      and(
        eq(adventRewardCodes.id, sql`(SELECT id FROM advent_reward_codes WHERE user_id IS NULL AND year = ${year} ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)`),
        isNull(adventRewardCodes.userId)
      )
    )
    .returning();
  if (!assigned) {
    console.warn("[advent] reward due but no codes left in the pool for", year);
    return null;
  }
  // A partner finishing at the same instant could have claimed too; keep
  // the earliest code and release the other.
  const mine = await db
    .select()
    .from(adventRewardCodes)
    .where(and(inArray(adventRewardCodes.userId, ids), eq(adventRewardCodes.year, year)))
    .orderBy(adventRewardCodes.id);
  if (mine.length > 1 && mine[0].id !== assigned.id) {
    await db.update(adventRewardCodes).set({ userId: null, assignedAt: null }).where(eq(adventRewardCodes.id, assigned.id));
    return null;
  }
  return assigned.code;
}

// ---------------- Admin ----------------
export async function updateAdventDay(day: number, patch: Partial<Omit<DayRow, "day" | "updatedAt">>) {
  const [row] = await db
    .update(adventDays)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(adventDays.day, day))
    .returning();
  return row;
}

export async function addAdventCodes(codes: string[], year: number): Promise<number> {
  const clean = [...new Set(codes.map((c) => c.trim()).filter((c) => /^[A-Za-z0-9_-]{4,40}$/.test(c)))];
  if (clean.length === 0) return 0;
  const rows = await db
    .insert(adventRewardCodes)
    .values(clean.map((code) => ({ code, year })))
    .onConflictDoNothing()
    .returning();
  return rows.length;
}

export async function getAdventStats(year: number) {
  const [participants, completions, codes] = await Promise.all([
    db.select().from(adventParticipants).where(eq(adventParticipants.year, year)),
    db.select().from(adventCompletions).where(eq(adventCompletions.year, year)),
    db.select().from(adventRewardCodes).where(eq(adventRewardCodes.year, year)),
  ]);
  const perDay = new Map<number, number>();
  for (const c of completions as { day: number }[]) perDay.set(c.day, (perDay.get(c.day) || 0) + 1);
  return {
    participants: participants.length,
    completions: completions.length,
    perDay,
    codesTotal: codes.length,
    codesAssigned: codes.filter((c: { userId: string | null }) => c.userId).length,
  };
}

// Users the 19:00 reminder goes to: in a couple that joined this year.
export async function getAdventReminderUserIds(year: number): Promise<Set<string>> {
  const rows = await db.select({ userId: adventParticipants.userId }).from(adventParticipants).where(eq(adventParticipants.year, year));
  return new Set(rows.map((r: { userId: string }) => r.userId));
}

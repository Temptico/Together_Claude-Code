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
import { sendAdventPoolAlert } from "./email.js";
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
const OFFER = { sl: `${SHOP}/sl-si`, en: `${SHOP}/en`, hr: `${SHOP}/hr-hr` };

type DefaultDay = { day: number; type: AdventType; sl: [string, string]; en: [string, string]; hr: [string, string] };

const DEFAULT_DAYS: DefaultDay[] = [
  { day: 1, type: "task",
    sl: ["Najlepši spomin", "Povejta si, kateri skupni trenutek iz tega leta vama je ostal v najlepšem spominu."],
    en: ["Best memory", "Tell each other which moment you shared this year you remember most fondly."],
    hr: ["Najljepša uspomena", "Recite jedno drugome koji vam je zajednički trenutak iz ove godine ostao u najljepšem sjećanju."] },
  { day: 2, type: "task",
    sl: ["Samo vidva", "Nocoj si vzemita čas za skupno večerjo brez telefonov in drugih zaslonov."],
    en: ["Just the two of you", "Tonight, take time for dinner together without phones or any other screens."],
    hr: ["Samo vas dvoje", "Večeras odvojite vrijeme za zajedničku večeru bez mobitela i drugih ekrana."] },
  { day: 3, type: "question",
    sl: ["Majhne pozornosti", "Kaj bi si vsak od vaju želel/a, da drugi pogosteje naredi?"],
    en: ["Small gestures", "What would each of you like the other to do more often?"],
    hr: ["Male pažnje", "Što bi svatko od vas želio/željela da drugi češće radi?"] },
  { day: 4, type: "task",
    sl: ["Skrito sporočilo", "Napišita si kratko lepo sporočilo in ga skrijta nekam, kjer ga bo drugi nepričakovano našel."],
    en: ["Hidden note", "Write each other a short, sweet note and hide it somewhere the other will find it unexpectedly."],
    hr: ["Skrivena poruka", "Napišite jedno drugome kratku lijepu poruku i sakrijte je negdje gdje će je drugi neočekivano pronaći."] },
  { day: 5, type: "task",
    sl: ["Filmski večer", "Skupaj izberita film, ki ga eden od vaju še ni videl, in si privoščita filmski večer."],
    en: ["Movie night", "Pick a film together that one of you hasn't seen yet and treat yourselves to a movie night."],
    hr: ["Filmska večer", "Zajedno odaberite film koji jedno od vas još nije gledalo i priuštite si filmsku večer."] },
  { day: 6, type: "temptico",
    sl: ["Miklavževo presenečenje", "Pripravita si majhno Miklavževo presenečenje. Lahko je darilce, najljubša sladkarija ali preprosta pozornost."],
    en: ["St. Nicholas surprise", "Prepare a small St. Nicholas surprise for each other. It can be a little gift, a favourite treat or a simple gesture."],
    hr: ["Iznenađenje za Svetog Nikolu", "Pripremite jedno drugome malo iznenađenje za Svetog Nikolu. Može biti darić, omiljena slatkica ili jednostavna pažnja."] },
  { day: 7, type: "question",
    sl: ["Sanje brez meja", "Če bi lahko živela kjer koli in počela kar koli, kako bi bilo videti vajino življenje?"],
    en: ["Dreams without limits", "If you could live anywhere and do anything, what would your life together look like?"],
    hr: ["Snovi bez granica", "Kad biste mogli živjeti bilo gdje i raditi bilo što, kako bi izgledao vaš zajednički život?"] },
  { day: 8, type: "task",
    sl: ["Skupna kuhinja", "Skupaj pripravita nekaj, česar še nikoli nista skuhala ali spekla."],
    en: ["Cooking together", "Make something together that you've never cooked or baked before."],
    hr: ["Zajednička kuhinja", "Zajedno pripremite nešto što još nikad niste skuhali ni ispekli."] },
  { day: 9, type: "question",
    sl: ["Lepo presenečenje", "Kateri trenutek z mano te je letos najbolj prijetno presenetil?"],
    en: ["A lovely surprise", "Which moment with me pleasantly surprised you the most this year?"],
    hr: ["Lijepo iznenađenje", "Koji te trenutak sa mnom ove godine najugodnije iznenadio?"] },
  { day: 10, type: "task",
    sl: ["Zimski sprehod", "Pojdita na sprehod in poiščita najlepše praznično okrašeno okno ali ulico v bližini."],
    en: ["Winter walk", "Go for a walk and find the most beautifully decorated window or street nearby."],
    hr: ["Zimska šetnja", "Prošećite i pronađite najljepše blagdanski ukrašen prozor ili ulicu u blizini."] },
  { day: 11, type: "question",
    sl: ["Spomini iz otroštva", "Katera praznična navada iz otroštva ti je najljubša in bi jo želel/a ohraniti tudi pri naju?"],
    en: ["Childhood memories", "Which holiday tradition from your childhood do you love most, and would you like us to keep it too?"],
    hr: ["Uspomene iz djetinjstva", "Koji ti je blagdanski običaj iz djetinjstva najdraži i bi li ga želio/željela zadržati i kod nas?"] },
  { day: 12, type: "task",
    sl: ["Tri zahvale", "Vsak napiše tri stvari, za katere je letos hvaležen/a drugemu. Nato si jih preberita na glas."],
    en: ["Three thank-yous", "Each of you writes down three things you're grateful to the other for this year. Then read them out loud."],
    hr: ["Tri zahvale", "Svatko napiše tri stvari na kojima je ove godine zahvalan/zahvalna drugome. Zatim ih pročitajte naglas."] },
  { day: 13, type: "temptico",
    sl: ["Večer ob svečah", "Ustvarita prijeten večer ob svečah. Ugasnita luči in si vzemita vsaj pol ure samo zase."],
    en: ["Candlelit evening", "Create a cosy candlelit evening. Switch off the lights and take at least half an hour just for the two of you."],
    hr: ["Večer uz svijeće", "Stvorite ugodnu večer uz svijeće. Ugasite svjetla i uzmite barem pola sata samo za sebe."] },
  { day: 14, type: "task",
    sl: ["Vajina voščilnica", "Naredita skupno praznično fotografijo, ki jo lahko pošljeta prijateljem ali družini kot voščilnico."],
    en: ["Your holiday card", "Take a festive photo together that you can send to friends or family as a holiday card."],
    hr: ["Vaša čestitka", "Snimite zajedničku blagdansku fotografiju koju možete poslati prijateljima ili obitelji kao čestitku."] },
  { day: 15, type: "question",
    sl: ["Leto spoznanj", "Kaj novega si letos spoznal/a o sebi ali o najinem odnosu?"],
    en: ["A year of discoveries", "What did you discover this year about yourself or about us?"],
    hr: ["Godina spoznaja", "Što si ove godine novo saznao/saznala o sebi ili o našem odnosu?"] },
  { day: 16, type: "task",
    sl: ["Vajin soundtrack", "Ustvarita seznam pesmi za praznične večere. Vsak naj doda pet pesmi, ki ga spominjajo na lepe trenutke."],
    en: ["Your soundtrack", "Make a playlist for holiday evenings. Each of you adds five songs that remind you of happy moments."],
    hr: ["Vaš soundtrack", "Složite playlistu za blagdanske večeri. Neka svatko doda pet pjesama koje ga podsjećaju na lijepe trenutke."] },
  { day: 17, type: "question",
    sl: ["Popoln zimski dan", "Kako bi bil videti tvoj popoln zimski dan, če bi ga lahko preživel/a samo z mano?"],
    en: ["Perfect winter day", "What would your perfect winter day look like if you could spend it just with me?"],
    hr: ["Savršen zimski dan", "Kako bi izgledao tvoj savršen zimski dan kad bi ga mogao/mogla provesti samo sa mnom?"] },
  { day: 18, type: "task",
    sl: ["Čas za sprostitev", "Izmenjajta si nežno masažo rok ali ramen. Vsak naj ima svojih deset minut."],
    en: ["Time to unwind", "Give each other a gentle hand or shoulder massage. Ten minutes each."],
    hr: ["Vrijeme za opuštanje", "Izmijenite nježnu masažu ruku ili ramena. Neka svatko ima svojih deset minuta."] },
  { day: 19, type: "question",
    sl: ["Neizrečena želja", "Katera želja za prihodnje leto ti že dolgo leži na srcu, pa je še nisi povedal/a na glas?"],
    en: ["Unspoken wish", "Which wish for next year has been on your heart for a long time, but you haven't said it out loud yet?"],
    hr: ["Neizrečena želja", "Koja ti želja za sljedeću godinu već dugo leži na srcu, a još je nisi izgovorio/izgovorila naglas?"] },
  { day: 20, type: "temptico",
    sl: ["Restavracija doma", "Naredita si večerjo kot v restavraciji: lepo pogrnita mizo, izberita glasbo in si privoščita nekaj posebnega."],
    en: ["Restaurant at home", "Have a restaurant-style dinner at home: set the table nicely, pick some music and treat yourselves to something special."],
    hr: ["Restoran kod kuće", "Priredite si večeru kao u restoranu: lijepo postavite stol, odaberite glazbu i priuštite si nešto posebno."] },
  { day: 21, type: "task",
    sl: ["Najdaljša noč", "Na najdaljšo noč v letu ugasnita vse luči razen ene. Ob njej si povejta, kaj vama je letos prineslo največ svetlobe."],
    en: ["The longest night", "On the longest night of the year, switch off every light but one. By its glow, tell each other what brought you the most light this year."],
    hr: ["Najduža noć", "U najdužoj noći u godini ugasite sva svjetla osim jednog. Uz njega recite jedno drugome što vam je ove godine donijelo najviše svjetla."] },
  { day: 22, type: "question",
    sl: ["Najini prazniki", "Kaj bi si želel/a, da bi naslednje praznike doživela drugače kot letos?"],
    en: ["Our holidays", "What would you like us to do differently next holiday season?"],
    hr: ["Naši blagdani", "Što bi želio/željela da sljedeće blagdane doživimo drugačije nego ove godine?"] },
  { day: 23, type: "temptico",
    sl: ["Vajin ritual", "Izberita majhno pozornost ali ritual, ki ga bosta ponovila vsak božič. Naj postane nekaj samo vajinega."],
    en: ["Your ritual", "Choose a small gesture or ritual you'll repeat every Christmas. Let it become something that's only yours."],
    hr: ["Vaš ritual", "Odaberite malu pažnju ili ritual koji ćete ponavljati svakog Božića. Neka postane nešto samo vaše."] },
  { day: 24, type: "task",
    sl: ["Pismo prihodnosti", "Napišita si pismo, ki ga bosta odprla naslednji božič. Zapišita, kaj si želita, da bi se do takrat zgodilo."],
    en: ["Letter to the future", "Write each other a letter to open next Christmas. Write down what you hope will have happened by then."],
    hr: ["Pismo budućnosti", "Napišite jedno drugome pismo koje ćete otvoriti sljedećeg Božića. Zapišite što želite da se do tada dogodi."] },
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
    // At most once a day: every app open of a waiting couple lands here.
    if (Date.now() - lastEmptyPoolAlert > 24 * 60 * 60 * 1000) {
      lastEmptyPoolAlert = Date.now();
      void sendAdventPoolAlert(0, true).catch(() => {});
    }
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
  const remaining = await freeCodeCount(year);
  if (POOL_ALERT_AT.has(remaining)) void sendAdventPoolAlert(remaining, false).catch(() => {});
  return assigned.code;
}

// Warn the admin when the pool drops below 20 free codes, and again at 10,
// 5 and when the last one is gone. Each assignment lowers the count by one,
// so every threshold is crossed exactly once.
export const POOL_ALERT_AT = new Set([19, 10, 5, 0]);
let lastEmptyPoolAlert = 0;

export async function freeCodeCount(year: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(adventRewardCodes)
    .where(and(eq(adventRewardCodes.year, year), isNull(adventRewardCodes.userId)));
  return Number(row?.n ?? 0);
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

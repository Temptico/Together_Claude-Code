// "What kind of couple are you?" — a 10-question quiz both partners take on
// their own. Every option leans towards one of four couple types; the
// couple's type is the one their answers lean to most, and the match score
// says how alike they answered. Shared by the server (validation) and the
// client (questions and the result screen), so both always agree.

export type QuizLang = "sl" | "en" | "hr";
export type CoupleType = "adventure" | "cozy" | "playful" | "deep";
export const COUPLE_TYPES: CoupleType[] = ["adventure", "playful", "cozy", "deep"];

type L = Record<QuizLang, string>;
type Option = { type: CoupleType; text: L };
type Question = { text: L; options: Option[] };

export const QUIZ_QUESTIONS: Question[] = [
  {
    text: { sl: "Prost petek zvečer. Kaj izbereta?", en: "A free Friday night. What do you pick?", hr: "Slobodan petak navečer. Što birate?" },
    options: [
      { type: "adventure", text: { sl: "Spontan izlet nekam, kjer še nisva bila", en: "A spontaneous trip somewhere new", hr: "Spontani izlet negdje gdje još nismo bili" } },
      { type: "cozy", text: { sl: "Odeja, film in najljubša hrana", en: "A blanket, a movie and our favourite food", hr: "Deka, film i omiljena hrana" } },
      { type: "playful", text: { sl: "Družabne igre s prijatelji", en: "Board games with friends", hr: "Društvene igre s prijateljima" } },
      { type: "deep", text: { sl: "Večerja ob svečah in dolg pogovor", en: "A candlelit dinner and a long talk", hr: "Večera uz svijeće i dug razgovor" } },
    ],
  },
  {
    text: { sl: "Najlepši dopust je …", en: "The best holiday is…", hr: "Najljepši odmor je…" },
    options: [
      { type: "deep", text: { sl: "Mirna plaža, knjige in sončni zahodi", en: "A quiet beach, books and sunsets", hr: "Mirna plaža, knjige i zalasci sunca" } },
      { type: "adventure", text: { sl: "Nahrbtnik in pot brez načrta", en: "A backpack and no plan", hr: "Ruksak i put bez plana" } },
      { type: "cozy", text: { sl: "Hiška v hribih s kaminom", en: "A mountain cabin with a fireplace", hr: "Kućica u planinama s kaminom" } },
      { type: "playful", text: { sl: "Mesto, polno festivalov in nočnega življenja", en: "A city full of festivals and nightlife", hr: "Grad pun festivala i noćnog života" } },
    ],
  },
  {
    text: { sl: "Kako najraje pokažeš ljubezen?", en: "How do you like to show love?", hr: "Kako najradije pokazuješ ljubav?" },
    options: [
      { type: "deep", text: { sl: "Z besedami in pogovori", en: "With words and long talks", hr: "Riječima i razgovorima" } },
      { type: "cozy", text: { sl: "Z dotiki in crkljanjem", en: "With touch and cuddles", hr: "Dodirima i maženjem" } },
      { type: "playful", text: { sl: "S šalami in presenečenji", en: "With jokes and surprises", hr: "Šalama i iznenađenjima" } },
      { type: "adventure", text: { sl: "S skupnimi doživetji", en: "With experiences we share", hr: "Zajedničkim doživljajima" } },
    ],
  },
  {
    text: { sl: "Nedeljsko jutro je …", en: "Sunday morning is…", hr: "Nedjeljno jutro je…" },
    options: [
      { type: "cozy", text: { sl: "Zajtrk v postelji", en: "Breakfast in bed", hr: "Doručak u krevetu" } },
      { type: "adventure", text: { sl: "Zgodnji pohod na hrib", en: "An early hike", hr: "Rani uspon na brdo" } },
      { type: "playful", text: { sl: "Brunch s prijatelji", en: "Brunch with friends", hr: "Brunch s prijateljima" } },
      { type: "deep", text: { sl: "Kava in pogovor o vsem", en: "Coffee and talking about everything", hr: "Kava i razgovor o svemu" } },
    ],
  },
  {
    text: { sl: "Ko se sporečeta, najprej …", en: "When you argue, you first…", hr: "Kad se posvađate, najprije…" },
    options: [
      { type: "playful", text: { sl: "razbijeta napetost s šalo", en: "break the tension with a joke", hr: "razbijete napetost šalom" } },
      { type: "deep", text: { sl: "se usedeta in pogovorita", en: "sit down and talk it through", hr: "sjednete i razgovarate" } },
      { type: "adventure", text: { sl: "gresta ven na sprehod", en: "go out for a walk", hr: "izađete u šetnju" } },
      { type: "cozy", text: { sl: "se objameta in pomirita", en: "hug it out and calm down", hr: "zagrlite se i smirite" } },
    ],
  },
  {
    text: { sl: "Popolno darilo je …", en: "The perfect gift is…", hr: "Savršen poklon je…" },
    options: [
      { type: "adventure", text: { sl: "Vstopnica za novo doživetje", en: "A ticket to a new experience", hr: "Ulaznica za novi doživljaj" } },
      { type: "deep", text: { sl: "Ročno napisano pismo", en: "A handwritten letter", hr: "Rukom pisano pismo" } },
      { type: "cozy", text: { sl: "Nekaj mehkega in toplega za dom", en: "Something soft and warm for home", hr: "Nešto mekano i toplo za dom" } },
      { type: "playful", text: { sl: "Smešno darilo z najino interno šalo", en: "A funny gift with our inside joke", hr: "Smiješan poklon s našom internom šalom" } },
    ],
  },
  {
    text: { sl: "Kaj vaju najbolj poveže?", en: "What brings you closest?", hr: "Što vas najviše povezuje?" },
    options: [
      { type: "playful", text: { sl: "Skupni smeh", en: "Laughing together", hr: "Zajednički smijeh" } },
      { type: "cozy", text: { sl: "Mirni trenutki doma", en: "Quiet moments at home", hr: "Mirni trenuci kod kuće" } },
      { type: "deep", text: { sl: "Iskreni pogovori", en: "Honest conversations", hr: "Iskreni razgovori" } },
      { type: "adventure", text: { sl: "Nova doživetja", en: "New adventures", hr: "Nove avanture" } },
    ],
  },
  {
    text: { sl: "Zmenek iz sanj je …", en: "A dream date is…", hr: "Spoj iz snova je…" },
    options: [
      { type: "cozy", text: { sl: "Kuhanje skupaj doma", en: "Cooking together at home", hr: "Zajedničko kuhanje kod kuće" } },
      { type: "adventure", text: { sl: "Let z balonom ob sončnem vzhodu", en: "A hot-air balloon at sunrise", hr: "Let balonom u zoru" } },
      { type: "deep", text: { sl: "Zvezdnato nebo in odeja", en: "A starry sky and a blanket", hr: "Zvjezdano nebo i deka" } },
      { type: "playful", text: { sl: "Karaoke in plesišče", en: "Karaoke and the dance floor", hr: "Karaoke i plesni podij" } },
    ],
  },
  {
    text: { sl: "Ko je dan težek, potrebujem …", en: "On a hard day I need…", hr: "Kad je dan težak, trebam…" },
    options: [
      { type: "deep", text: { sl: "nekoga, ki me posluša", en: "someone to listen", hr: "nekoga tko me sluša" } },
      { type: "playful", text: { sl: "nekaj, kar me nasmeji", en: "something that makes me laugh", hr: "nešto što me nasmije" } },
      { type: "cozy", text: { sl: "dolg objem", en: "a long hug", hr: "dug zagrljaj" } },
      { type: "adventure", text: { sl: "spremembo okolja", en: "a change of scenery", hr: "promjenu okoline" } },
    ],
  },
  {
    text: { sl: "Čez deset let naju vidim …", en: "In ten years I see us…", hr: "Za deset godina vidim nas…" },
    options: [
      { type: "playful", text: { sl: "z veliko prijateljev in zabave", en: "surrounded by friends and fun", hr: "s puno prijatelja i zabave" } },
      { type: "adventure", text: { sl: "na potovanju okoli sveta", en: "travelling the world", hr: "na putovanju oko svijeta" } },
      { type: "deep", text: { sl: "še bolj povezana kot danes", en: "even closer than today", hr: "još povezanije nego danas" } },
      { type: "cozy", text: { sl: "v domu, polnem topline", en: "in a home full of warmth", hr: "u domu punom topline" } },
    ],
  },
];

export const QUIZ_LENGTH = QUIZ_QUESTIONS.length;

type TypeInfo = { emoji: string; name: L; description: L; strengths: Record<QuizLang, string[]>; tip: L; dates: Record<QuizLang, string[]> };

export const COUPLE_TYPE_INFO: Record<CoupleType, TypeInfo> = {
  adventure: {
    emoji: "🏔️",
    name: { sl: "Pustolovca", en: "The Adventurers", hr: "Avanturisti" },
    description: {
      sl: "Vajina ljubezen raste ob novih doživetjih. Najbolj živa sta, ko skupaj odkrivata svet, od spontanih izletov do noro dobrih idej.",
      en: "Your love grows with every new experience. You feel most alive discovering the world together, from spontaneous trips to wonderfully crazy ideas.",
      hr: "Vaša ljubav raste uz nova iskustva. Najživlji ste kad zajedno otkrivate svijet, od spontanih izleta do ludo dobrih ideja.",
    },
    strengths: { sl: ["Spontanost", "Pogum", "Skupni spomini"], en: ["Spontaneity", "Courage", "Shared memories"], hr: ["Spontanost", "Hrabrost", "Zajedničke uspomene"] },
    tip: {
      sl: "Ne pozabita na mirne večere. Včasih je največja pustolovščina pogovor do jutra.",
      en: "Don't forget the quiet evenings. Sometimes the biggest adventure is talking until sunrise.",
      hr: "Ne zaboravite na mirne večeri. Ponekad je najveća avantura razgovor do jutra.",
    },
    dates: {
      sl: ["Sončni vzhod na bližnjem hribu", "Izlet v kraj, kjer še nista bila", "Soba pobega ali adrenalinski park"],
      en: ["Sunrise on a nearby hill", "A trip to a place you've never been", "An escape room or adventure park"],
      hr: ["Izlazak sunca na obližnjem brdu", "Izlet u mjesto gdje još niste bili", "Escape room ili adrenalinski park"],
    },
  },
  cozy: {
    emoji: "🕯️",
    name: { sl: "Domača romantika", en: "The Cozy Romantics", hr: "Kućni romantičari" },
    description: {
      sl: "Vajin najljubši kraj je drug ob drugem. Topel dom, dobra hrana in objem na kavču vama pomenijo več kot katera koli zabava.",
      en: "Your favourite place is next to each other. A warm home, good food and a cuddle on the sofa mean more to you than any party.",
      hr: "Vaše omiljeno mjesto je jedno uz drugo. Topli dom, dobra hrana i zagrljaj na kauču znače vam više od bilo kakve zabave.",
    },
    strengths: { sl: ["Toplina", "Zaupanje", "Nežnost"], en: ["Warmth", "Trust", "Tenderness"], hr: ["Toplina", "Povjerenje", "Nježnost"] },
    tip: {
      sl: "Občasno stopita iz cone udobja. Nova doživetja vajino toplino še okrepijo.",
      en: "Step out of your comfort zone now and then. New experiences make your warmth even stronger.",
      hr: "Povremeno izađite iz zone komfora. Novi doživljaji vašu toplinu čine još jačom.",
    },
    dates: {
      sl: ["Kuhanje večerje iz druge države", "Filmski maraton z odejo in kokicami", "Masaža ob svečah"],
      en: ["Cooking a dinner from another country", "A movie marathon with blankets and popcorn", "A candlelit massage"],
      hr: ["Kuhanje večere iz druge zemlje", "Filmski maraton s dekom i kokicama", "Masaža uz svijeće"],
    },
  },
  playful: {
    emoji: "🎉",
    name: { sl: "Zabavna ekipa", en: "The Fun Squad", hr: "Zabavna ekipa" },
    description: {
      sl: "Pri vama je smeh vedno blizu. Igrivost, interne šale in dobra družba vaju držijo skupaj. Z vama ni nikoli dolgčas.",
      en: "Laughter is never far away with you two. Playfulness, inside jokes and good company keep you together. Life with you is never boring.",
      hr: "Kod vas je smijeh uvijek blizu. Zaigranost, interne šale i dobro društvo drže vas zajedno. S vama nikad nije dosadno.",
    },
    strengths: { sl: ["Humor", "Lahkotnost", "Energija"], en: ["Humour", "Lightness", "Energy"], hr: ["Humor", "Lakoća", "Energija"] },
    tip: {
      sl: "Vzemita si čas tudi za resnejše pogovore. Globina bo vajino zabavo naredila še lepšo.",
      en: "Make time for deeper talks too. A little depth makes all the fun even better.",
      hr: "Odvojite vrijeme i za ozbiljnije razgovore. Dubina će vašu zabavu učiniti još ljepšom.",
    },
    dates: {
      sl: ["Karaoke večer", "Družabne igre in pica", "Kegljanje ali zabaviščni park"],
      en: ["A karaoke night", "Board games and pizza", "Bowling or a fun fair"],
      hr: ["Karaoke večer", "Društvene igre i pizza", "Kuglanje ili zabavni park"],
    },
  },
  deep: {
    emoji: "💬",
    name: { sl: "Globoka povezanost", en: "The Soul Connection", hr: "Duboka povezanost" },
    description: {
      sl: "Vajina ljubezen temelji na razumevanju. Pogovarjata se o vsem, se poslušata in se razumeta tudi brez besed.",
      en: "Your love is built on understanding. You talk about everything, you listen, and you get each other even without words.",
      hr: "Vaša ljubav temelji se na razumijevanju. Razgovarate o svemu, slušate se i razumijete i bez riječi.",
    },
    strengths: { sl: ["Razumevanje", "Iskrenost", "Čustvena bližina"], en: ["Understanding", "Honesty", "Emotional closeness"], hr: ["Razumijevanje", "Iskrenost", "Emocionalna bliskost"] },
    tip: {
      sl: "Dodajta malo spontanosti. Nepričakovana dogodivščina prinese nove teme za pogovor.",
      en: "Add a dash of spontaneity. An unexpected adventure brings new things to talk about.",
      hr: "Dodajte malo spontanosti. Neočekivana pustolovina donosi nove teme za razgovor.",
    },
    dates: {
      sl: ["Večerja ob svečah brez telefonov", "Opazovanje zvezd z odejo", "Pisma drug drugemu za čez pet let"],
      en: ["A phone-free candlelit dinner", "Stargazing under a blanket", "Letters to each other to open in five years"],
      hr: ["Večera uz svijeće bez mobitela", "Promatranje zvijezda pod dekom", "Pisma jedno drugome za za pet godina"],
    },
  },
};

export function isValidQuizAnswers(answers: unknown): answers is number[] {
  return (
    Array.isArray(answers) &&
    answers.length === QUIZ_LENGTH &&
    answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < QUIZ_QUESTIONS[i].options.length)
  );
}

function typesOf(answers: number[]): CoupleType[] {
  return answers.map((a, i) => QUIZ_QUESTIONS[i].options[a].type);
}

function dominant(counts: Record<CoupleType, number>): CoupleType {
  // Ties go to the earlier type in COUPLE_TYPES, so the result is stable.
  return COUPLE_TYPES.reduce((best, t) => (counts[t] > counts[best] ? t : best), COUPLE_TYPES[0]);
}

function count(types: CoupleType[]): Record<CoupleType, number> {
  const c = { adventure: 0, cozy: 0, playful: 0, deep: 0 };
  for (const t of types) c[t]++;
  return c;
}

// One person's own leaning.
export function personalType(answers: number[]): CoupleType {
  return dominant(count(typesOf(answers)));
}

// Energetic types sit next to each other, as do the calm ones, so a
// "close" answer still counts for something.
const NEIGHBOURS: Record<CoupleType, CoupleType> = { adventure: "playful", playful: "adventure", cozy: "deep", deep: "cozy" };

export type CoupleQuizResult = { type: CoupleType; match: number; same: boolean[]; mine: CoupleType; theirs: CoupleType };

export function coupleResult(mine: number[], theirs: number[]): CoupleQuizResult {
  const a = typesOf(mine);
  const b = typesOf(theirs);
  const same = a.map((t, i) => t === b[i]);
  const points = a.reduce((sum, t, i) => sum + (t === b[i] ? 1 : NEIGHBOURS[t] === b[i] ? 0.6 : 0.3), 0);
  const counts = count([...a, ...b]);
  // Answers they share weigh a little more, so a tie leans to common ground.
  a.forEach((t, i) => {
    if (same[i]) counts[t] += 0.5;
  });
  return { type: dominant(counts), match: Math.round((points / QUIZ_LENGTH) * 100), same, mine: personalType(mine), theirs: personalType(theirs) };
}

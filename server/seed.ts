import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { questions, challenges, dateIdeas } from "../shared/schema.js";

const QUESTIONS: { text: string; textEn: string; textHr: string; category: string }[] = [
  { text: "Kaj je bil danes najboljši del tvojega dne?", textEn: "What was the best part of your day today?", textHr: "Što je bio najbolji dio tvog dana danas?", category: "vsakdan" },
  { text: "Za kaj si danes hvaležen oziroma hvaležna?", textEn: "What are you grateful for today?", textHr: "Na čemu si danas zahvalan/zahvalna?", category: "hvaleznost" },
  { text: "Če bi lahko jutri naredil/a karkoli, kaj bi to bilo?", textEn: "If you could do anything tomorrow, what would it be?", textHr: "Kad bi sutra mogao/mogla raditi bilo što, što bi to bilo?", category: "sanje" },
  { text: "Katera je tvoja najljubša skupna spomin?", textEn: "What's your favorite shared memory?", textHr: "Koja je tvoja najdraža zajednička uspomena?", category: "spomini" },
  { text: "Kaj te je danes najbolj presenetilo?", textEn: "What surprised you the most today?", textHr: "Što te danas najviše iznenadilo?", category: "vsakdan" },
  { text: "Kaj je tvoja trenutna skrb?", textEn: "What's on your mind right now that's worrying you?", textHr: "Što te trenutno najviše brine?", category: "custva" },
  { text: "Kaj bi rad/a izboljšal/a v najini zvezi?", textEn: "What would you like to improve in our relationship?", textHr: "Što bi želio/željela poboljšati u našoj vezi?", category: "odnos" },
  { text: "Katera je tvoja najljubša lastnost pri meni?", textEn: "What's your favorite thing about me?", textHr: "Koja je tvoja najdraža osobina kod mene?", category: "odnos" },
  { text: "Kaj te osrečuje?", textEn: "What makes you happy?", textHr: "Što te čini sretnim/sretnom?", category: "sreca" },
  { text: "Kako najraje preživljaš prosti čas?", textEn: "How do you like to spend your free time?", textHr: "Kako najradije provodiš slobodno vrijeme?", category: "hobiji" },
  { text: "Kateri kraj bi si najbolj želel/a obiskati skupaj?", textEn: "What place would you most like us to visit together?", textHr: "Koje mjesto bi najviše želio/željela posjetiti zajedno?", category: "sanje" },
  { text: "Kaj ti pomeni beseda dom?", textEn: "What does the word \"home\" mean to you?", textHr: "Što ti znači riječ dom?", category: "custva" },
  { text: "Na kaj si v zadnjem tednu najbolj ponosen/ponosna?", textEn: "What are you most proud of from this past week?", textHr: "Na što si najviše ponosan/ponosna u proteklom tjednu?", category: "vsakdan" },
  { text: "Kaj je bilo tvoje najljubše darilo, ki si ga kdaj prejel/a?", textEn: "What's the best gift you've ever received?", textHr: "Koji je bio tvoj najdraži poklon koji si ikad dobio/dobila?", category: "spomini" },
  { text: "Kako si predstavljaš najin popoln vikend?", textEn: "What does your perfect weekend with me look like?", textHr: "Kako zamišljaš naš savršen vikend?", category: "sanje" },
  { text: "Kaj bi rad/a, da se drug o drugem naučiva letos?", textEn: "What would you like us to learn about each other this year?", textHr: "Što bi želio/željela da naučimo jedno o drugome ove godine?", category: "odnos" },
  { text: "Katera navada pri meni te najbolj nasmeji?", textEn: "Which habit of mine makes you laugh the most?", textHr: "Koja te moja navika najviše nasmijava?", category: "sreca" },
  { text: "Kaj je bil najbolj noro doživetje v tvojem življenju?", textEn: "What's the craziest experience you've ever had?", textHr: "Koje je bilo najluđe iskustvo u tvom životu?", category: "spomini" },
  { text: "Kako veš, da te imam rad/a?", textEn: "How do you know that I love you?", textHr: "Kako znaš da te volim?", category: "custva" },
  { text: "Kaj bi počel/a, če bi imel/a popolnoma prost dan brez obveznosti?", textEn: "What would you do with a completely free day with no obligations?", textHr: "Što bi radio/radila kad bi imao/imala potpuno slobodan dan bez obaveza?", category: "sanje" },
  { text: "Katero prigodo iz otroštva bi rad/a, da bolje poznam?", textEn: "What childhood story would you like me to know better?", textHr: "Koju bi priču iz djetinjstva želio/željela da bolje upoznam?", category: "spomini" },
  { text: "Kaj ti trenutno povzroča največ stresa in kako ti lahko pomagam?", textEn: "What's causing you the most stress right now, and how can I help?", textHr: "Što ti trenutno stvara najviše stresa i kako ti mogu pomoći?", category: "custva" },
  { text: "Kaj je nekaj, kar bi rad/a poskusil/a, a si še nisi upal/a?", textEn: "What's something you'd like to try but haven't dared to yet?", textHr: "Što je nešto što bi želio/željela probati, a još se nisi usudio/usudila?", category: "sanje" },
  { text: "Kaj te je pri meni prepričalo na najinem prvem zmenku?", textEn: "What convinced you about me on our first date?", textHr: "Što te uvjerilo u mene na našem prvom spoju?", category: "spomini" },
  { text: "Kateri je tvoj najljubši način, da ti pokažem ljubezen?", textEn: "What's your favorite way for me to show you love?", textHr: "Koji je tvoj najdraži način na koji ti pokazujem ljubav?", category: "odnos" },
  { text: "Kaj bi rad/a, da počneva več skupaj?", textEn: "What would you like us to do more of together?", textHr: "Što bi želio/željela da radimo više zajedno?", category: "odnos" },
  { text: "Kateri majhen trenutek te je ta teden osrečil?", textEn: "What small moment made you happy this week?", textHr: "Koji te mali trenutak usrećio ovaj tjedan?", category: "vsakdan" },
  { text: "Za kaj v najinem odnosu si najbolj hvaležen/hvaležna?", textEn: "What are you most grateful for in our relationship?", textHr: "Na čemu si najviše zahvalan/zahvalna u našoj vezi?", category: "hvaleznost" },
  { text: "Kaj bi rad/a, da si zapomniva iz letošnjega leta?", textEn: "What would you like us to remember from this year?", textHr: "Što bi želio/željela da zapamtimo iz ove godine?", category: "spomini" },
  { text: "Kako se najraje sprostiš po napornem dnevu?", textEn: "How do you like to unwind after a long day?", textHr: "Kako se najradije opustiš nakon napornog dana?", category: "hobiji" },
  { text: "Kaj je nekaj, kar občuduješ pri meni, pa ti tega morda nikoli nisem povedal/a?", textEn: "What's something you admire about me that I might not know?", textHr: "Što je nešto što diviš kod mene, a možda ti to nikad nisam rekao/rekla?", category: "odnos" },
  { text: "Kje vidiva sebe čez pet let?", textEn: "Where do we see ourselves in five years?", textHr: "Gdje se vidimo za pet godina?", category: "sanje" },
  { text: "Kaj je tvoja najljubša skupna tradicija?", textEn: "What's your favorite tradition of ours?", textHr: "Koja je tvoja najdraža naša tradicija?", category: "spomini" },
  { text: "Kako ti lahko olajšam ta teden?", textEn: "How can I make this week easier for you?", textHr: "Kako ti mogu olakšati ovaj tjedan?", category: "custva" },
  { text: "Kaj bi si želel/a, da počneva na najinem naslednjem dopustu?", textEn: "What would you like us to do on our next vacation?", textHr: "Što bi želio/željela da radimo na našem sljedećem odmoru?", category: "sanje" },
];

const CHALLENGES: { text: string; textEn: string; textHr: string; category: string; difficulty: string }[] = [
  { text: "Povejta si razlog, zakaj se imata rada.", textEn: "Tell each other the reason you love one another.", textHr: "Recite jedno drugome razlog zašto se volite.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj skuhajta nov recept.", textEn: "Cook a new recipe together.", textHr: "Skuhajte novi recept zajedno.", category: "aktivnost", difficulty: "medium" },
  { text: "Napišita si ljubezenski pismi.", textEn: "Write each other love letters.", textHr: "Napišite jedno drugome ljubavna pisma.", category: "romantika", difficulty: "easy" },
  { text: "Sprehodita se brez telefonov.", textEn: "Go for a walk without your phones.", textHr: "Prošetajte bez mobitela.", category: "narava", difficulty: "easy" },
  { text: "Plešita ob najljubši pesmi.", textEn: "Dance to your favorite song.", textHr: "Zaplešite uz svoju najdražu pjesmu.", category: "zabava", difficulty: "easy" },
  { text: "Načrtujta prihodnje potovanje.", textEn: "Plan a future trip together.", textHr: "Isplanirajte buduće putovanje.", category: "nacrtovanje", difficulty: "medium" },
  { text: "Skupaj gledata sončni vzhod ali zahod.", textEn: "Watch a sunrise or sunset together.", textHr: "Zajedno pogledajte izlazak ili zalazak sunca.", category: "romantika", difficulty: "medium" },
  { text: "Naredita fotografiranje drug drugega.", textEn: "Take photos of each other.", textHr: "Fotografirajte jedno drugo.", category: "kreativnost", difficulty: "easy" },
  { text: "Skupaj meditirajta 10 minut.", textEn: "Meditate together for 10 minutes.", textHr: "Meditirajte zajedno 10 minuta.", category: "wellness", difficulty: "easy" },
  { text: "Pripravita presenečenje drug za drugega.", textEn: "Prepare a surprise for each other.", textHr: "Pripremite iznenađenje jedno za drugo.", category: "presenecenja", difficulty: "hard" },
  { text: "Napišita drug drugemu 5 stvari, ki jih cenita drug pri drugem.", textEn: "Write each other 5 things you appreciate about one another.", textHr: "Napišite jedno drugome 5 stvari koje cijenite jedno kod drugoga.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj sestavita seznam predvajanja s pesmimi, ki vaju spominjajo drug na drugega.", textEn: "Make a playlist together of songs that remind you of each other.", textHr: "Zajedno napravite playlistu pjesama koje vas podsjećaju jedno na drugo.", category: "kreativnost", difficulty: "easy" },
  { text: "En dan brez pritoževanja — poskusita opaziti in izreči samo pozitivne stvari.", textEn: "One day without complaining — try to notice and say only positive things.", textHr: "Jedan dan bez žalbi — pokušajte primijetiti i izgovoriti samo pozitivne stvari.", category: "komunikacija", difficulty: "medium" },
  { text: "Skupaj naredita 15 minut vadbe ali raztezanja.", textEn: "Do 15 minutes of exercise or stretching together.", textHr: "Zajedno odradite 15 minuta vježbanja ili istezanja.", category: "wellness", difficulty: "easy" },
  { text: "Obudita spomin na prvi zmenek — pojdita na podoben kraj ali ponovita aktivnost.", textEn: "Relive your first date — go to a similar place or repeat the activity.", textHr: "Prisjetite se prvog spoja — otiđite na slično mjesto ili ponovite aktivnost.", category: "romantika", difficulty: "medium" },
  { text: "Vsak napiše 3 stvari, ki bi jih rad/a poskusil/a v prihodnjem letu, in si jih delita.", textEn: "Each write 3 things you'd like to try in the coming year, and share them.", textHr: "Svako neka napiše 3 stvari koje bi želio/željela probati sljedeće godine, pa ih podijelite.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Skupaj pospravita in preuredita en prostor v domu.", textEn: "Tidy up and rearrange a room in your home together.", textHr: "Zajedno pospremite i preuredite jednu prostoriju u domu.", category: "aktivnost", difficulty: "medium" },
  { text: "Naredita seznam 10 stvari, za katere sta drug drugemu hvaležna.", textEn: "Make a list of 10 things you're grateful to each other for.", textHr: "Napravite popis 10 stvari za koje ste zahvalni jedno drugome.", category: "komunikacija", difficulty: "easy" },
  { text: "Preizkusita novo igro ali družabno igro, ki je še nista igrala.", textEn: "Try a new game or board game you haven't played before.", textHr: "Isprobajte novu igru ili društvenu igru koju još niste igrali.", category: "zabava", difficulty: "easy" },
  { text: "Pošlji/pošljita si sporočilo sredi dneva samo zato, da poveste, da razmišljata drug o drugem.", textEn: "Send each other a message in the middle of the day just to say you're thinking of one another.", textHr: "Pošaljite jedno drugome poruku usred dana samo da kažete da mislite jedno na drugo.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj naredita nekaj dobrodelnega ali pomagajta nekomu v skupnosti.", textEn: "Do something charitable together, or help someone in your community.", textHr: "Zajedno učinite nešto dobrotvorno ili pomozite nekome u zajednici.", category: "presenecenja", difficulty: "hard" },
  { text: "En večer brez zaslonov — telefone odložita za vsaj dve uri.", textEn: "One evening without screens — put your phones away for at least two hours.", textHr: "Jedna večer bez ekrana — odložite mobitele barem na dva sata.", category: "narava", difficulty: "medium" },
  { text: "Preglejta stare fotografije ali videe iz vajine zveze in obudita spomine.", textEn: "Look through old photos or videos from your relationship and relive the memories.", textHr: "Pregledajte stare fotografije ili videe iz vaše veze i prisjetite se uspomena.", category: "romantika", difficulty: "easy" },
];

const DATE_IDEAS: Array<{
  title: string;
  description: string;
  category: string;
  cost: string;
  duration: string;
  locationType?: string;
  city?: string;
  address?: string;
  tags?: string[];
  lat?: number;
  lng?: number;
}> = [
  // Doma
  { title: "Kuhanje novega recepta", description: "Izbrajta si recept, ki ga še nista poskusila, in ga skupaj pripravita.", category: "doma", cost: "eur", duration: "1h" },
  { title: "Virtualni obisk muzeja", description: "Raziščita enega izmed svetovnih muzejev prek spletnega virtualnega ogleda.", category: "doma", cost: "brezplacno", duration: "1h" },
  { title: "Ustvarjanje skupnega seznama želja", description: "Zapišita si stvari, ki bi ju rada skupaj doživela.", category: "doma", cost: "brezplacno", duration: "30min" },
  { title: "Filmski maraton", description: "Izberita trilogijo ali serijo filmov in preživita večer z njimi.", category: "doma", cost: "brezplacno", duration: "2h+" },
  { title: "Ples v dnevni sobi", description: "Predvajajta najljubšo glasbo in zaplešita, kot da vaju nihče ne gleda.", category: "doma", cost: "brezplacno", duration: "30min" },
  { title: "Spa večer doma", description: "Pripravita si domač spa večer z maskami za obraz in sproščujočo glasbo.", category: "doma", cost: "eur", duration: "1h" },
  { title: "Igranje starih videoiger", description: "Obudita spomine z igranjem iger iz otroštva.", category: "doma", cost: "brezplacno", duration: "1h" },
  // Na prostem
  { title: "Sprehod po Tivoliju", description: "Sproščen sprehod po največjem ljubljanskem parku.", category: "na-prostem", cost: "brezplacno", duration: "1h", locationType: "parki", city: "Ljubljana", lat: 46.0569, lng: 14.4885 },
  { title: "Kolesarjenje po Ljubljani", description: "Raziščita mesto na dveh kolesih.", category: "na-prostem", cost: "brezplacno", duration: "2h", locationType: "rekreacijski-centri", city: "Ljubljana", lat: 46.0511, lng: 14.5051 },
  { title: "Piknik na Rožniku", description: "Vzemita odejo in malico ter uživajta v razgledu na mesto.", category: "na-prostem", cost: "brezplacno", duration: "2h+", locationType: "naravni-kraji", city: "Ljubljana", lat: 46.065, lng: 14.4687 },
  { title: "Vrtnarjenje", description: "Posadita nekaj skupaj, za kar bosta lahko skupaj skrbela.", category: "na-prostem", cost: "eur", duration: "1h" },
  { title: "Pohod na Šmarno goro", description: "Priljubljena ljubljanska razgledna točka, primerna za par ur pohoda.", category: "na-prostem", cost: "brezplacno", duration: "2h+", locationType: "naravni-kraji", city: "Ljubljana", lat: 46.1225, lng: 14.4557 },
  // Kulturno
  { title: "Obisk Narodne galerije", description: "Ogled slovenske umetnostne zgodovine v središču mesta.", category: "kulturno", cost: "eur", duration: "2h", locationType: "galerije", city: "Ljubljana", address: "Prešernova cesta 24", lat: 46.0508, lng: 14.4989 },
  { title: "Obisk gledališča", description: "Preverita repertoar in si izberita predstavo, ki vaju zanima.", category: "kulturno", cost: "eur2", duration: "2h+", locationType: "gledalisca", city: "Ljubljana" },
  { title: "Muzej iluzij", description: "Zabavna in fotogenična izkušnja za pare.", category: "kulturno", cost: "eur2", duration: "1h", locationType: "muzeji", city: "Ljubljana", address: "Kongresni trg 3", lat: 46.0494, lng: 14.5044 },
  { title: "Obisk mestne knjižnice", description: "Poiščita si knjigo, ki jo bosta prebrala vsak zase ali skupaj na glas.", category: "kulturno", cost: "brezplacno", duration: "1h", locationType: "knjiznice", city: "Ljubljana" },
  { title: "Ogled Ljubljanskega gradu", description: "Sprehod do gradu z razgledom na celotno mesto.", category: "kulturno", cost: "eur2", duration: "2h", locationType: "muzeji", city: "Ljubljana", lat: 46.0489, lng: 14.5083 },
  // Aktivno
  { title: "Plezanje", description: "Preizkusita se v športnem plezanju v plezalnem centru.", category: "aktivno", cost: "eur2", duration: "2h", locationType: "rekreacijski-centri", city: "Ljubljana" },
  { title: "Kegljanje", description: "Zabavno tekmovanje med partnerjema.", category: "aktivno", cost: "eur2", duration: "1h", locationType: "rekreacijski-centri", city: "Ljubljana" },
  { title: "Drsanje", description: "Zimska aktivnost na ljubljanskem drsališču.", category: "aktivno", cost: "eur", duration: "1h", locationType: "rekreacijski-centri", city: "Ljubljana" },
  { title: "Mini golf", description: "Sproščena in zabavna igra na prostem.", category: "aktivno", cost: "eur", duration: "1h", locationType: "rekreacijski-centri", city: "Ljubljana" },
  { title: "Tekaška tura", description: "Skupaj preteczita svojo najljubšo traso.", category: "aktivno", cost: "brezplacno", duration: "1h" },
  // Sproscceno
  { title: "Kava v centru", description: "Poiščita novo kavarno in poskusita njihovo posebno ponudbo.", category: "sprosceno", cost: "eur", duration: "30min", locationType: "kavarne", city: "Ljubljana", lat: 46.0511, lng: 14.5061 },
  { title: "Nakupovanje", description: "Sproščen dan brskanja po trgovinah brez pritiska po nakupu.", category: "sprosceno", cost: "eur2", duration: "2h", locationType: "trgovine", city: "Ljubljana" },
  { title: "Sladoled v mestu", description: "Poiščita najboljšo sladoledarno v okolici.", category: "sprosceno", cost: "eur", duration: "30min", locationType: "kavarne", city: "Ljubljana" },
  { title: "Obisk živalskega vrta", description: "Sproščen družinski dan v ljubljanskem živalskem vrtu.", category: "sprosceno", cost: "eur2", duration: "2h+", locationType: "parki", city: "Ljubljana", address: "Večna pot 70", lat: 46.0447, lng: 14.4681 },
  { title: "Branje v parku", description: "Vzemita knjigo in poiščita mirno klopco v parku.", category: "sprosceno", cost: "brezplacno", duration: "1h", locationType: "parki", city: "Ljubljana" },
  // €€€
  { title: "Večerja v vrhunski restavraciji", description: "Razvajajta se z izbranim menijem v eni izmed najboljših restavracij v mestu.", category: "sprosceno", cost: "eur3", duration: "2h", locationType: "restavracije", city: "Ljubljana" },
  { title: "Spa vikend za dva", description: "Pobegnita od vsakdana s celodnevnim wellness razvajanjem in savnami.", category: "sprosceno", cost: "eur3", duration: "2h+", locationType: "rekreacijski-centri", city: "Ljubljana" },
  { title: "Let z balonom nad Ljubljano", description: "Doživita mesto z drugačne perspektive na nepozabnem poletu z balonom.", category: "aktivno", cost: "eur3", duration: "2h+", city: "Ljubljana" },
  { title: "Degustacija vin v vinski kleti", description: "Odkrijta okuse slovenskih vin ob vodenem pokušanju z lokalnim sommelierjem.", category: "kulturno", cost: "eur3", duration: "2h", locationType: "vinarije", city: "Ljubljana" },
  { title: "Zasebna kuharska delavnica", description: "Pod vodstvom kuharja skupaj pripravita večerni meni po meri.", category: "aktivno", cost: "eur3", duration: "2h", city: "Ljubljana" },
];

export async function runSeed() {
  const existingQuestions = await db.select().from(questions);
  const existingQuestionsByText = new Map(existingQuestions.map((q: { text: string }) => [q.text, q]));
  const missingQuestions = QUESTIONS.filter((q) => !existingQuestionsByText.has(q.text));
  if (missingQuestions.length > 0) {
    await db.insert(questions).values(missingQuestions);
    console.log(`[seed] Inserted ${missingQuestions.length} questions`);
  }
  // Backfill EN/HR text on rows that were seeded before translations existed.
  for (const q of QUESTIONS) {
    const existing = existingQuestionsByText.get(q.text) as typeof questions.$inferSelect | undefined;
    if (existing && (!existing.textEn || !existing.textHr)) {
      await db.update(questions).set({ textEn: q.textEn, textHr: q.textHr }).where(eq(questions.id, existing.id));
    }
  }

  const existingChallenges = await db.select().from(challenges);
  const existingChallengesByText = new Map(existingChallenges.map((c: { text: string }) => [c.text, c]));
  const missingChallenges = CHALLENGES.filter((c) => !existingChallengesByText.has(c.text));
  if (missingChallenges.length > 0) {
    await db.insert(challenges).values(missingChallenges);
    console.log(`[seed] Inserted ${missingChallenges.length} challenges`);
  }
  for (const c of CHALLENGES) {
    const existing = existingChallengesByText.get(c.text) as typeof challenges.$inferSelect | undefined;
    if (existing && (!existing.textEn || !existing.textHr)) {
      await db.update(challenges).set({ textEn: c.textEn, textHr: c.textHr }).where(eq(challenges.id, existing.id));
    }
  }

  const existingIdeas = await db.select().from(dateIdeas);
  const existingTitles = new Set(existingIdeas.map((i: { title: string }) => i.title));
  const missingIdeas = DATE_IDEAS.filter((idea) => !existingTitles.has(idea.title));
  if (missingIdeas.length > 0) {
    await db.insert(dateIdeas).values(missingIdeas as any);
    console.log(`[seed] Inserted ${missingIdeas.length} date ideas`);
  }
}

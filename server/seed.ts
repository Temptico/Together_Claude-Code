import { db } from "./db.js";
import { questions, challenges, dateIdeas } from "../shared/schema.js";

const QUESTIONS: { text: string; category: string }[] = [
  { text: "Kaj je bil danes najboljši del tvojega dne?", category: "vsakdan" },
  { text: "Za kaj si danes hvaležen oziroma hvaležna?", category: "hvaleznost" },
  { text: "Če bi lahko jutri naredil/a karkoli, kaj bi to bilo?", category: "sanje" },
  { text: "Katera je tvoja najljubša skupna spomin?", category: "spomini" },
  { text: "Kaj te je danes najbolj presenetilo?", category: "vsakdan" },
  { text: "Kaj je tvoja trenutna skrb?", category: "custva" },
  { text: "Kaj bi rad/a izboljšal/a v najini zvezi?", category: "odnos" },
  { text: "Katera je tvoja najljubša lastnost pri meni?", category: "odnos" },
  { text: "Kaj te osrečuje?", category: "sreca" },
  { text: "Kako najraje preživljaš prosti čas?", category: "hobiji" },
  { text: "Kateri kraj bi si najbolj želel/a obiskati skupaj?", category: "sanje" },
  { text: "Kaj ti pomeni beseda dom?", category: "custva" },
  { text: "Na kaj si v zadnjem tednu najbolj ponosen/ponosna?", category: "vsakdan" },
  { text: "Kaj je bilo tvoje najljubše darilo, ki si ga kdaj prejel/a?", category: "spomini" },
  { text: "Kako si predstavljaš najin popoln vikend?", category: "sanje" },
  { text: "Kaj bi rad/a, da se drug o drugem naučiva letos?", category: "odnos" },
  { text: "Katera navada pri meni te najbolj nasmeji?", category: "sreca" },
  { text: "Kaj je bil najbolj noro doživetje v tvojem življenju?", category: "spomini" },
  { text: "Kako veš, da te imam rad/a?", category: "custva" },
  { text: "Kaj bi počel/a, če bi imel/a popolnoma prost dan brez obveznosti?", category: "sanje" },
  { text: "Katero prigodo iz otroštva bi rad/a, da bolje poznam?", category: "spomini" },
  { text: "Kaj ti trenutno povzroča največ stresa in kako ti lahko pomagam?", category: "custva" },
  { text: "Kaj je nekaj, kar bi rad/a poskusil/a, a si še nisi upal/a?", category: "sanje" },
  { text: "Kaj te je pri meni prepričalo na najinem prvem zmenku?", category: "spomini" },
  { text: "Kateri je tvoj najljubši način, da ti pokažem ljubezen?", category: "odnos" },
  { text: "Kaj bi rad/a, da počneva več skupaj?", category: "odnos" },
  { text: "Kateri majhen trenutek te je ta teden osrečil?", category: "vsakdan" },
  { text: "Za kaj v najinem odnosu si najbolj hvaležen/hvaležna?", category: "hvaleznost" },
  { text: "Kaj bi rad/a, da si zapomniva iz letošnjega leta?", category: "spomini" },
  { text: "Kako se najraje sprostiš po napornem dnevu?", category: "hobiji" },
  { text: "Kaj je nekaj, kar občuduješ pri meni, pa ti tega morda nikoli nisem povedal/a?", category: "odnos" },
  { text: "Kje vidiva sebe čez pet let?", category: "sanje" },
  { text: "Kaj je tvoja najljubša skupna tradicija?", category: "spomini" },
  { text: "Kako ti lahko olajšam ta teden?", category: "custva" },
  { text: "Kaj bi si želel/a, da počneva na najinem naslednjem dopustu?", category: "sanje" },
];

const CHALLENGES: { text: string; category: string; difficulty: string }[] = [
  { text: "Povejta si razlog, zakaj se imata rada.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj skuhajta nov recept.", category: "aktivnost", difficulty: "medium" },
  { text: "Napišita si ljubezenski pismi.", category: "romantika", difficulty: "easy" },
  { text: "Sprehodita se brez telefonov.", category: "narava", difficulty: "easy" },
  { text: "Plešita ob najljubši pesmi.", category: "zabava", difficulty: "easy" },
  { text: "Načrtujta prihodnje potovanje.", category: "nacrtovanje", difficulty: "medium" },
  { text: "Skupaj gledata sončni vzhod ali zahod.", category: "romantika", difficulty: "medium" },
  { text: "Naredita fotografiranje drug drugega.", category: "kreativnost", difficulty: "easy" },
  { text: "Skupaj meditirajta 10 minut.", category: "wellness", difficulty: "easy" },
  { text: "Pripravita presenečenje drug za drugega.", category: "presenecenja", difficulty: "hard" },
  { text: "Napišita drug drugemu 5 stvari, ki jih cenita drug pri drugem.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj sestavita seznam predvajanja s pesmimi, ki vaju spominjajo drug na drugega.", category: "kreativnost", difficulty: "easy" },
  { text: "En dan brez pritoževanja — poskusita opaziti in izreči samo pozitivne stvari.", category: "komunikacija", difficulty: "medium" },
  { text: "Skupaj naredita 15 minut vadbe ali raztezanja.", category: "wellness", difficulty: "easy" },
  { text: "Obudita spomin na prvi zmenek — pojdita na podoben kraj ali ponovita aktivnost.", category: "romantika", difficulty: "medium" },
  { text: "Vsak napiše 3 stvari, ki bi jih rad/a poskusil/a v prihodnjem letu, in si jih delita.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Skupaj pospravita in preuredita en prostor v domu.", category: "aktivnost", difficulty: "medium" },
  { text: "Naredita seznam 10 stvari, za katere sta drug drugemu hvaležna.", category: "komunikacija", difficulty: "easy" },
  { text: "Preizkusita novo igro ali družabno igro, ki je še nista igrala.", category: "zabava", difficulty: "easy" },
  { text: "Pošlji/pošljita si sporočilo sredi dneva samo zato, da poveste, da razmišljata drug o drugem.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj naredita nekaj dobrodelnega ali pomagajta nekomu v skupnosti.", category: "presenecenja", difficulty: "hard" },
  { text: "En večer brez zaslonov — telefone odložita za vsaj dve uri.", category: "narava", difficulty: "medium" },
  { text: "Preglejta stare fotografije ali videe iz vajine zveze in obudita spomine.", category: "romantika", difficulty: "easy" },
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
  const existingQuestionTexts = new Set(existingQuestions.map((q: { text: string }) => q.text));
  const missingQuestions = QUESTIONS.filter((q) => !existingQuestionTexts.has(q.text));
  if (missingQuestions.length > 0) {
    await db.insert(questions).values(missingQuestions);
    console.log(`[seed] Inserted ${missingQuestions.length} questions`);
  }

  const existingChallenges = await db.select().from(challenges);
  const existingChallengeTexts = new Set(existingChallenges.map((c: { text: string }) => c.text));
  const missingChallenges = CHALLENGES.filter((c) => !existingChallengeTexts.has(c.text));
  if (missingChallenges.length > 0) {
    await db.insert(challenges).values(missingChallenges);
    console.log(`[seed] Inserted ${missingChallenges.length} challenges`);
  }

  const existingIdeas = await db.select().from(dateIdeas);
  const existingTitles = new Set(existingIdeas.map((i: { title: string }) => i.title));
  const missingIdeas = DATE_IDEAS.filter((idea) => !existingTitles.has(idea.title));
  if (missingIdeas.length > 0) {
    await db.insert(dateIdeas).values(missingIdeas as any);
    console.log(`[seed] Inserted ${missingIdeas.length} date ideas`);
  }
}

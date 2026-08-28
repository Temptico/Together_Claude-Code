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
  { text: "Kaj ti je trenutno najbolj všeč v najinem odnosu?", textEn: "What do you love most about our relationship right now?", textHr: "Što ti se trenutno najviše sviđa u našoj vezi?", category: "odnos" },
  { text: "Kaj bi si želel/a, da bi skupaj počela pogosteje?", textEn: "What would you like us to do together more often?", textHr: "Što bi želio/željela da radimo zajedno češće?", category: "odnos" },
  { text: "Kateri najin skupni trenutek ti je trenutno najljubši?", textEn: "What's your favorite moment of ours right now?", textHr: "Koji ti je trenutno najdraži naš zajednički trenutak?", category: "spomini" },
  { text: "Kaj lahko naredim, da se boš danes počutil/a bolj ljubljeno?", textEn: "What can I do to help you feel more loved today?", textHr: "Što mogu učiniti da se danas osjećaš voljenije?", category: "custva" },
  { text: "Katera moja lastnost ti je bila všeč že na začetku?", textEn: "Which of my traits did you like from the very start?", textHr: "Koja ti se moja osobina svidjela već na početku?", category: "spomini" },
  { text: "Kaj misliš, da je najina največja prednost kot para?", textEn: "What do you think is our biggest strength as a couple?", textHr: "Što misliš da nam je najveća prednost kao paru?", category: "odnos" },
  { text: "Kaj bi rad/a izboljšal/a pri najini komunikaciji?", textEn: "What would you like to improve about how we communicate?", textHr: "Što bi želio/željela poboljšati u našoj komunikaciji?", category: "odnos" },
  { text: "Kdaj se ob meni počutiš najbolj sproščeno?", textEn: "When do you feel most relaxed around me?", textHr: "Kada se najviše opustiš uz mene?", category: "custva" },
  { text: "Kaj je nekaj, kar bi rad/a, da skupaj prvič doživiva?", textEn: "What's something you'd like us to experience together for the first time?", textHr: "Što je nešto što bi želio/željela da zajedno prvi put doživimo?", category: "sanje" },
  { text: "Kateri najin zmenek si najbolj zapomniš?", textEn: "Which of our dates do you remember most?", textHr: "Kojeg se našeg spoja najviše sjećaš?", category: "spomini" },
  { text: "Kaj ti pri meni največ pomeni?", textEn: "What matters to you most about me?", textHr: "Što ti kod mene najviše znači?", category: "odnos" },
  { text: "Kdaj si se nazadnje zaradi mene počutil/a posebej cenjeno?", textEn: "When did you last feel especially valued because of me?", textHr: "Kada si se zadnji put zbog mene osjećao/osjećala posebno cijenjeno?", category: "custva" },
  { text: "Kaj bi želel/a, da bolje razumem o tebi?", textEn: "What would you like me to understand better about you?", textHr: "Što bi želio/željela da bolje razumijem o tebi?", category: "odnos" },
  { text: "Katera najina skupna navada ti je najbolj všeč?", textEn: "Which of our shared habits do you like the most?", textHr: "Koja ti se naša zajednička navika najviše sviđa?", category: "vsakdan" },
  { text: "Kaj je nekaj majhnega, kar naredim in ti polepša dan?", textEn: "What's something small I do that brightens your day?", textHr: "Što je nešto malo što učinim, a uljepša ti dan?", category: "custva" },
  { text: "Kaj bi lahko naredila samo za naju ta vikend?", textEn: "What could we do just for the two of us this weekend?", textHr: "Što bismo mogli učiniti samo za nas ovaj vikend?", category: "nacrtovanje" },
  { text: "Kateri je tvoj najljubši način preživljanja časa z mano?", textEn: "What's your favorite way to spend time with me?", textHr: "Koji ti je najdraži način provođenja vremena sa mnom?", category: "odnos" },
  { text: "Kaj je nekaj, kar bi se rad/a naučil/a skupaj z mano?", textEn: "What's something you'd like to learn together with me?", textHr: "Što je nešto što bi želio/željela naučiti zajedno sa mnom?", category: "sanje" },
  { text: "Kateri najin trenutek bi rad/a še enkrat doživel/a?", textEn: "Which moment of ours would you like to relive?", textHr: "Koji bi naš trenutak želio/željela ponovno doživjeti?", category: "spomini" },
  { text: "Kaj misliš, da naju najbolj povezuje?", textEn: "What do you think connects us the most?", textHr: "Što misliš da nas najviše povezuje?", category: "odnos" },
  { text: "Kaj si pri meni opazil/a, preden sem jaz to opazil/a?", textEn: "What did you notice about me before I noticed it myself?", textHr: "Što si kod mene primijetio/primijetila prije nego što sam ja to primijetio/la?", category: "odnos" },
  { text: "Kaj je nekaj, za kar si mi hvaležen/hvaležna?", textEn: "What's something you're grateful to me for?", textHr: "Što je nešto za što si mi zahvalan/zahvalna?", category: "hvaleznost" },
  { text: "Kdaj se ti zdim najbolj privlačen/privlačna?", textEn: "When do you find me most attractive?", textHr: "Kada ti se činim najprivlačnijim/najprivlačnijom?", category: "custva" },
  { text: "Kaj bi rad/a, da bi večkrat naredila spontano?", textEn: "What would you like us to do more spontaneously?", textHr: "Što bi želio/željela da radimo spontanije?", category: "odnos" },
  { text: "Kaj je nekaj, kar te pri meni vedno nasmeji?", textEn: "What's something about me that always makes you smile?", textHr: "Što je nešto kod mene što te uvijek nasmije?", category: "sreca" },
  { text: "Katera skupna potovanja bi si želel/a?", textEn: "What trips would you like us to take together?", textHr: "Koja bi zajednička putovanja želio/željela?", category: "sanje" },
  { text: "Kaj bi bil zate popoln dan, ki bi ga preživela skupaj?", textEn: "What would be your perfect day spent together?", textHr: "Kakav bi za tebe bio savršen dan koji bismo proveli zajedno?", category: "sanje" },
  { text: "Kaj je nekaj, česar o tebi še ne vem?", textEn: "What's something about you I don't know yet?", textHr: "Što je nešto o tebi što još ne znam?", category: "odnos" },
  { text: "Kateri moj kompliment si najbolj zapomniš?", textEn: "Which compliment of mine do you remember most?", textHr: "Kojeg se mog komplimenta najviše sjećaš?", category: "spomini" },
  { text: "Kaj bi želel/a, da nikoli ne izgubiva v najinem odnosu?", textEn: "What would you never want us to lose in our relationship?", textHr: "Što nikad ne bi želio/željela da izgubimo u našoj vezi?", category: "odnos" },
  { text: "Katera najina interna šala ti je najljubša?", textEn: "What's your favorite inside joke of ours?", textHr: "Koja ti je najdraža naša unutarnja šala?", category: "sreca" },
  { text: "Kaj ti pomeni kakovosten čas v dvoje?", textEn: "What does quality time together mean to you?", textHr: "Što ti znači kvalitetno vrijeme u dvoje?", category: "odnos" },
  { text: "Kaj bi lahko naredila, ko imava oba slab dan?", textEn: "What could we do when we're both having a bad day?", textHr: "Što bismo mogli učiniti kad oboje imamo loš dan?", category: "odnos" },
  { text: "Kdaj se počutiš najbolj povezano z mano?", textEn: "When do you feel most connected to me?", textHr: "Kada se osjećaš najpovezanije sa mnom?", category: "custva" },
  { text: "Kaj je nekaj, kar bi rad/a, da letos doživiva?", textEn: "What's something you'd like us to experience this year?", textHr: "Što je nešto što bi želio/željela da ove godine doživimo?", category: "sanje" },
  { text: "Kaj bi izbral/a: spontano potovanje ali načrtovan dopust?", textEn: "Would you choose a spontaneous trip or a planned vacation?", textHr: "Što bi izabrao/izabrala: spontano putovanje ili planirani odmor?", category: "sanje" },
  { text: "Kateri film najbolj opisuje najino razmerje?", textEn: "Which movie best describes our relationship?", textHr: "Koji film najbolje opisuje naš odnos?", category: "odnos" },
  { text: "Katera pesem te spomni name?", textEn: "What song reminds you of me?", textHr: "Koja te pjesma podsjeća na mene?", category: "spomini" },
  { text: "Kaj je nekaj, kar bi rad/a ponovno počela iz začetka najine zveze?", textEn: "What's something from the start of our relationship you'd like to do again?", textHr: "Što je nešto s početka naše veze što bi želio/željela ponovno raditi?", category: "spomini" },
  { text: "Kaj je bila tvoja prva misel po najinem prvem zmenku?", textEn: "What was your first thought after our first date?", textHr: "Koja ti je bila prva misao nakon našeg prvog spoja?", category: "spomini" },
  { text: "Kaj misliš, da sva se od začetka zveze najbolj naučila?", textEn: "What do you think we've learned the most since we started dating?", textHr: "Što misliš da smo najviše naučili od početka veze?", category: "odnos" },
  { text: "Kaj bi svetoval/a najini verziji izpred enega leta?", textEn: "What advice would you give to us from a year ago?", textHr: "Što bi savjetovao/savjetovala nama od prije godinu dana?", category: "odnos" },
  { text: "Kaj je nekaj, kar lahko naredim, ko potrebuješ podporo?", textEn: "What's something I can do when you need support?", textHr: "Što je nešto što mogu učiniti kad ti treba podrška?", category: "custva" },
  { text: "Kaj ti pomeni romantika?", textEn: "What does romance mean to you?", textHr: "Što ti znači romantika?", category: "odnos" },
  { text: "Kateri moj pogled ti je najbolj všeč?", textEn: "Which look of mine do you like the most?", textHr: "Koji ti se moj pogled najviše sviđa?", category: "custva" },
  { text: "Kaj je nekaj, kar bi rada naredila brez telefona?", textEn: "What's something you'd like us to do without our phones?", textHr: "Što je nešto što bismo željeli raditi bez mobitela?", category: "hobiji" },
  { text: "Kateri najin skupni cilj te najbolj veseli?", textEn: "Which of our shared goals excites you the most?", textHr: "Koji te naš zajednički cilj najviše veseli?", category: "sanje" },
  { text: "Kaj bi izbral/a za najin naslednji zmenek?", textEn: "What would you choose for our next date?", textHr: "Što bi izabrao/izabrala za naš sljedeći spoj?", category: "sanje" },
  { text: "Katero mojo navado bi z veseljem prevzel/a?", textEn: "Which of my habits would you happily pick up?", textHr: "Koju bi moju naviku rado preuzeo/preuzela?", category: "odnos" },
  { text: "Kaj misliš, da bi lahko skupaj izboljšala v naslednjem mesecu?", textEn: "What do you think we could improve together next month?", textHr: "Što misliš da bismo mogli poboljšati zajedno idući mjesec?", category: "odnos" },
  { text: "Kaj je tvoja najljubša stvar, ki jo počneva doma?", textEn: "What's your favorite thing we do at home?", textHr: "Što ti je najdraža stvar koju radimo kod kuće?", category: "vsakdan" },
  { text: "Kaj te pri meni najbolj preseneti?", textEn: "What surprises you most about me?", textHr: "Što te kod mene najviše iznenađuje?", category: "odnos" },
  { text: "Kdaj si nazadnje pomislil/a: »Res imam srečo, da te imam«?", textEn: "When did you last think, \"I'm so lucky to have you\"?", textHr: "Kada si zadnji put pomislio/pomislila: \"Stvarno imam sreće što te imam\"?", category: "hvaleznost" },
  { text: "Kaj bi rad/a, da skupaj praznujeva?", textEn: "What would you like us to celebrate together?", textHr: "Što bi želio/željela da zajedno proslavimo?", category: "nacrtovanje" },
  { text: "Kaj je nekaj, kar si želiš doživeti pred 30. letom?", textEn: "What's something you want to experience before turning 30?", textHr: "Što je nešto što želiš doživjeti prije 30. rođendana?", category: "sanje" },
  { text: "Kaj ti je bilo pri meni najprej fizično všeč?", textEn: "What did you first find physically attractive about me?", textHr: "Što ti se kod mene prvo fizički svidjelo?", category: "spomini" },
  { text: "Kaj ti je bilo pri meni najprej všeč kot osebi?", textEn: "What did you first like about me as a person?", textHr: "Što ti se kod mene prvo svidjelo kao kod osobe?", category: "spomini" },
  { text: "Kaj bi naredila, če bi imela skupaj prostih 10.000 €?", textEn: "What would we do if we had a spare €10,000 together?", textHr: "Što bismo napravili kad bismo imali slobodnih 10.000 € zajedno?", category: "sanje" },
  { text: "Kam bi šla, če bi lahko jutri odpotovala kamorkoli?", textEn: "Where would we go if we could travel anywhere tomorrow?", textHr: "Kamo bismo otišli kad bismo sutra mogli putovati bilo kamo?", category: "sanje" },
  { text: "Kaj je tvoja idealna nedelja z mano?", textEn: "What's your ideal Sunday with me?", textHr: "Kakva ti je idealna nedjelja sa mnom?", category: "sanje" },
  { text: "Kaj je nekaj, kar te vedno spravi v dobro voljo?", textEn: "What's something that always puts you in a good mood?", textHr: "Što je nešto što te uvijek stavi u dobro raspoloženje?", category: "sreca" },
  { text: "Kaj bi rada, da bi bilo del najine prihodnosti?", textEn: "What would you like to be part of our future?", textHr: "Što bi želio/željela da bude dio naše budućnosti?", category: "sanje" },
  { text: "Kaj je najlepši kompliment, ki si ga kdaj dobil/a od mene?", textEn: "What's the nicest compliment you've ever gotten from me?", textHr: "Koji je najljepši kompliment koji si ikad dobio/dobila od mene?", category: "spomini" },
  { text: "Katera moja gesta ti največ pomeni?", textEn: "Which gesture of mine means the most to you?", textHr: "Koja ti moja gesta najviše znači?", category: "custva" },
  { text: "Kaj bi želel/a, da počneva večkrat samo midva?", textEn: "What would you like us to do more often, just the two of us?", textHr: "Što bi želio/željela da radimo češće, samo nas dvoje?", category: "odnos" },
  { text: "Kaj je nekaj, kar bi rad/a skupaj ustvarila?", textEn: "What's something you'd like us to create together?", textHr: "Što je nešto što bismo željeli zajedno stvoriti?", category: "sanje" },
  { text: "Kaj ti je ljubše: miren večer doma ali spontan večer zunaj?", textEn: "Which do you prefer: a quiet night in or a spontaneous night out?", textHr: "Što ti je draže: miran večer kod kuće ili spontana večer vani?", category: "odnos" },
  { text: "Kateri skupni spomin ti vedno nariše nasmeh?", textEn: "Which shared memory always brings a smile to your face?", textHr: "Koja te zajednička uspomena uvijek nasmije?", category: "spomini" },
  { text: "Kaj je nekaj, pri čemer misliš, da sva zelo dobra ekipa?", textEn: "What's something you think we're a really good team at?", textHr: "U čemu misliš da smo stvarno dobar tim?", category: "odnos" },
  { text: "Kaj bi želel/a, da si zapomniva čez 20 let?", textEn: "What would you like us to remember in 20 years?", textHr: "Što bi želio/željela da zapamtimo za 20 godina?", category: "sanje" },
  { text: "Kateri trenutek iz najinega odnosa bi pokazal/a svojim otrokom?", textEn: "Which moment from our relationship would you show your kids?", textHr: "Koji bi trenutak iz naše veze pokazao/pokazala svojoj djeci?", category: "spomini" },
  { text: "Kaj bi lahko naredila, da bi imela več časa drug za drugega?", textEn: "What could we do to have more time for each other?", textHr: "Što bismo mogli učiniti da imamo više vremena jedno za drugo?", category: "odnos" },
  { text: "Kaj je nekaj, kar si želiš, da bi ti večkrat povedal/a?", textEn: "What's something you wish I told you more often?", textHr: "Što je nešto što bi želio/željela da ti češće kažem?", category: "custva" },
  { text: "Katera moja beseda ali fraza ti je najbolj smešna?", textEn: "Which word or phrase of mine do you find funniest?", textHr: "Koja ti je moja riječ ili fraza najsmješnija?", category: "sreca" },
  { text: "Kaj je nekaj, kar si zaradi mene začel/a gledati drugače?", textEn: "What's something you started seeing differently because of me?", textHr: "Što je nešto što si zbog mene počeo/počela gledati drugačije?", category: "odnos" },
  { text: "Katera skupna aktivnost ti najbolj napolni baterije?", textEn: "Which shared activity recharges you the most?", textHr: "Koja te zajednička aktivnost najviše napuni energijom?", category: "hobiji" },
  { text: "Kaj je nekaj, kar bi rad/a naredila samo zato, ker je zabavno?", textEn: "What's something you'd like us to do just because it's fun?", textHr: "Što je nešto što bismo željeli raditi samo zato jer je zabavno?", category: "hobiji" },
  { text: "Kaj ti je najlepše pri najini vsakodnevni rutini?", textEn: "What do you love most about our everyday routine?", textHr: "Što ti je najljepše u našoj svakodnevnoj rutini?", category: "vsakdan" },
  { text: "Kaj bi si želel/a, da bi bilo najino življenje čez 5 let?", textEn: "What would you like our life to look like in 5 years?", textHr: "Kakav bi želio/željela da nam život bude za 5 godina?", category: "sanje" },
  { text: "Kaj je ena stvar, ki bi jo lahko danes naredila drugače?", textEn: "What's one thing we could do differently today?", textHr: "Koja je jedna stvar koju bismo danas mogli učiniti drugačije?", category: "odnos" },
  { text: "Kateri najin trenutek je bil najbolj spontan?", textEn: "What was our most spontaneous moment?", textHr: "Koji je naš trenutak bio najspontaniji?", category: "spomini" },
  { text: "Kaj je nekaj, kar si želiš, da bi te vprašal/a pogosteje?", textEn: "What's something you wish I asked you more often?", textHr: "Što je nešto što bi želio/željela da te pitam češće?", category: "custva" },
  { text: "Kaj je tvoj najljubši način, da ti pokažem ljubezen?", textEn: "What's your favorite way for me to show you love?", textHr: "Koji ti je najdraži način na koji ti pokazujem ljubav?", category: "odnos" },
  { text: "Kaj misliš, da je najina najbolj podcenjena skupna aktivnost?", textEn: "What do you think is our most underrated shared activity?", textHr: "Što misliš da nam je najpodcjenjenija zajednička aktivnost?", category: "hobiji" },
  { text: "Kateri moj nasmeh ti je najbolj všeč?", textEn: "Which of my smiles do you like best?", textHr: "Koji ti se moj osmijeh najviše sviđa?", category: "custva" },
  { text: "Kaj je nekaj, kar bi želel/a skupaj doživeti prvič?", textEn: "What's something you'd like us to experience for the first time?", textHr: "Što je nešto što bismo željeli prvi put doživjeti zajedno?", category: "sanje" },
  { text: "Kaj je nekaj, kar bi lahko naredila vsak mesec kot najin ritual?", textEn: "What could we do every month as our own ritual?", textHr: "Što bismo mogli raditi svaki mjesec kao naš ritual?", category: "nacrtovanje" },
  { text: "Kaj je tvoja najljubša stvar pri najini osebnosti kot para?", textEn: "What's your favorite thing about who we are as a couple?", textHr: "Što ti je najdraža stvar u tome kakvi smo par?", category: "odnos" },
  { text: "Kaj je nekaj, kar se lahko od tebe naučim?", textEn: "What's something I could learn from you?", textHr: "Što je nešto što bih mogao/mogla naučiti od tebe?", category: "odnos" },
  { text: "Kaj misliš, da se lahko jaz od tebe naučim?", textEn: "What do you think I could learn from you?", textHr: "Što misliš da bih ja mogao/mogla naučiti od tebe?", category: "odnos" },
  { text: "Kateri najin pogovor ti je ostal v spominu?", textEn: "Which conversation of ours has stayed with you?", textHr: "Koji ti je naš razgovor ostao u sjećanju?", category: "spomini" },
  { text: "Kaj bi naredila, če bi imela cel dan samo zase?", textEn: "What would you do with a whole day just for yourself?", textHr: "Što bi radio/radila kad bi imao/imala cijeli dan samo za sebe?", category: "sanje" },
  { text: "Kaj je nekaj, kar ti daje občutek varnosti v najinem odnosu?", textEn: "What's something that makes you feel safe in our relationship?", textHr: "Što je nešto što ti daje osjećaj sigurnosti u našoj vezi?", category: "custva" },
  { text: "Kaj je nekaj, kar bi rad/a skupaj obeležila letos?", textEn: "What's something you'd like us to mark or celebrate together this year?", textHr: "Što je nešto što bismo željeli zajedno obilježiti ove godine?", category: "nacrtovanje" },
  { text: "Kaj je tvoja najljubša stvar pri najini bližini?", textEn: "What's your favorite thing about our closeness?", textHr: "Što ti je najdraža stvar u našoj bliskosti?", category: "custva" },
  { text: "Kaj bi želel/a, da bi bila najina naslednja velika dogodivščina?", textEn: "What would you like our next big adventure to be?", textHr: "Što bi želio/željela da nam bude sljedeća velika avantura?", category: "sanje" },
  { text: "Kaj je nekaj, kar bi rada počela, ko bova starejša?", textEn: "What's something you'd like us to do when we're older?", textHr: "Što je nešto što bismo željeli raditi kad budemo stariji?", category: "sanje" },
  { text: "Kaj bi želel/a, da si o najini zvezi vedno zapomniva?", textEn: "What would you like us to always remember about our relationship?", textHr: "Što bi želio/željela da uvijek pamtimo o našoj vezi?", category: "odnos" },
  { text: "Kaj je ena stvar, ki jo lahko danes naredim zate?", textEn: "What's one thing I can do for you today?", textHr: "Koja je jedna stvar koju danas mogu učiniti za tebe?", category: "custva" },
  { text: "Če bi moral/a najin odnos opisati s tremi besedami, katere bi izbral/a?", textEn: "If you had to describe our relationship in three words, which would you choose?", textHr: "Kad bi naš odnos morao/morala opisati s tri riječi, koje bi izabrao/izabrala?", category: "odnos" },
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
  { text: "Naredita 20-minutni sprehod brez telefonov.", textEn: "Take a 20-minute walk without your phones.", textHr: "Prošetajte 20 minuta bez mobitela.", category: "narava", difficulty: "easy" },
  { text: "Drug drugemu pripravita najljubši napitek.", textEn: "Make each other your favorite drink.", textHr: "Pripremite jedno drugome najdraže piće.", category: "romantika", difficulty: "easy" },
  { text: "Odigrata igro, ki je še nikoli nista igrala.", textEn: "Play a game you've never played before.", textHr: "Odigrajte igru koju nikad niste igrali.", category: "zabava", difficulty: "easy" },
  { text: "Naredita skupni selfie na najbolj nenavadnem mestu doma.", textEn: "Take a selfie together in the strangest spot in your home.", textHr: "Napravite zajednički selfie na najneobičnijem mjestu u domu.", category: "kreativnost", difficulty: "easy" },
  { text: "Vsak napiše tri stvari, ki jih ima rad pri drugem.", textEn: "Each write down three things you love about the other.", textHr: "Svako neka napiše tri stvari koje voli kod drugoga.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj skuhajta jed, ki je še nikoli nista pripravila.", textEn: "Cook a dish together you've never made before.", textHr: "Skuhajte jelo koje nikad niste pripremili.", category: "aktivnost", difficulty: "medium" },
  { text: "Poglejta eno epizodo serije, ki jo izbere partner.", textEn: "Watch one episode of a show your partner picks.", textHr: "Pogledajte jednu epizodu serije koju izabere partner.", category: "zabava", difficulty: "easy" },
  { text: "Vsak pove eno stvar, za katero je danes hvaležen.", textEn: "Each say one thing you're grateful for today.", textHr: "Svako neka kaže jednu stvar za koju je danas zahvalan/zahvalna.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita 10-minutno masažo drug drugemu.", textEn: "Give each other a 10-minute massage.", textHr: "Napravite jedno drugome 10-minutnu masažu.", category: "wellness", difficulty: "easy" },
  { text: "Pojdita na mini zmenek za manj kot 10 €.", textEn: "Go on a mini date for under €10.", textHr: "Idite na mini spoj za manje od 10 €.", category: "romantika", difficulty: "medium" },
  { text: "Skupaj poslušajta vajino najljubšo pesem.", textEn: "Listen to your favorite song together.", textHr: "Zajedno poslušajte vašu najdražu pjesmu.", category: "romantika", difficulty: "easy" },
  { text: "Naredita fotografijo, ki poustvari vajin prvi skupni selfie.", textEn: "Recreate your first selfie together.", textHr: "Napravite fotografiju koja rekreira vaš prvi zajednički selfie.", category: "kreativnost", difficulty: "easy" },
  { text: "Vsak pripravi eno presenečenje za drugega.", textEn: "Each prepare a surprise for the other.", textHr: "Svako neka pripremi iznenađenje za drugo.", category: "presenecenja", difficulty: "medium" },
  { text: "Pojdita spat eno uro prej in preživita čas skupaj.", textEn: "Go to bed an hour earlier and spend the time together.", textHr: "Idite spavati sat ranije i provedite to vrijeme zajedno.", category: "wellness", difficulty: "easy" },
  { text: "Skupaj pripravita zajtrk.", textEn: "Make breakfast together.", textHr: "Pripremite zajedno doručak.", category: "aktivnost", difficulty: "easy" },
  { text: "Naredita večer brez telefonov.", textEn: "Have a phone-free evening.", textHr: "Priredite večer bez mobitela.", category: "narava", difficulty: "easy" },
  { text: "Izberita naključno destinacijo na zemljevidu in jo raziskujta.", textEn: "Pick a random spot on the map and look it up together.", textHr: "Izaberite nasumičnu destinaciju na karti i istražite je.", category: "nacrtovanje", difficulty: "medium" },
  { text: "Igrajta kamen, papir, škarje – poraženec naredi nekaj za zmagovalca.", textEn: "Play rock-paper-scissors — the loser does something for the winner.", textHr: "Igrajte kamen, škare, papir — gubitnik napravi nešto za pobjednika.", category: "zabava", difficulty: "easy" },
  { text: "Vsak drugemu napiše kratko ljubezensko sporočilo.", textEn: "Each write the other a short love note.", textHr: "Svako neka napiše drugome kratku ljubavnu poruku.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita 15-minutni plesni večer.", textEn: "Have a 15-minute dance party.", textHr: "Priredite 15-minutnu plesnu zabavu.", category: "zabava", difficulty: "easy" },
  { text: "Skupaj si oglejta stare fotografije.", textEn: "Look through old photos together.", textHr: "Zajedno pregledajte stare fotografije.", category: "romantika", difficulty: "easy" },
  { text: "Vsak izbere pesem, ki ga spominja na drugega.", textEn: "Each pick a song that reminds you of the other.", textHr: "Svako neka izabere pjesmu koja ga podsjeća na drugo.", category: "romantika", difficulty: "easy" },
  { text: "Pripravita večerjo samo iz sestavin, ki jih že imata doma.", textEn: "Make dinner using only ingredients you already have at home.", textHr: "Pripremite večeru samo od sastojaka koje već imate kod kuće.", category: "aktivnost", difficulty: "medium" },
  { text: "Naredita piknik v dnevni sobi.", textEn: "Have a picnic in your living room.", textHr: "Priredite piknik u dnevnoj sobi.", category: "romantika", difficulty: "easy" },
  { text: "Skupaj rešita uganko ali križanko.", textEn: "Solve a puzzle or crossword together.", textHr: "Zajedno riješite zagonetku ili križaljku.", category: "kreativnost", difficulty: "easy" },
  { text: "Pojdita na sprehod in vsak izbere naslednji zavoj.", textEn: "Go for a walk and take turns choosing which way to turn.", textHr: "Prošetajte i naizmjenično birajte sljedeći skretanje.", category: "narava", difficulty: "easy" },
  { text: "Naredita tekmovanje v kuhanju.", textEn: "Have a cooking competition.", textHr: "Priredite kuharsko natjecanje.", category: "aktivnost", difficulty: "medium" },
  { text: "Vsak pove eno stvar, ki jo želi letos doživeti.", textEn: "Each share one thing you want to experience this year.", textHr: "Svako neka kaže jednu stvar koju želi doživjeti ove godine.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Skupaj napišita seznam 10 stvari, ki jih želita narediti kot par.", textEn: "Write a list of 10 things you want to do as a couple.", textHr: "Napišite popis 10 stvari koje želite raditi kao par.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Naredita filmski večer z naključnim filmom.", textEn: "Have a movie night with a randomly chosen film.", textHr: "Priredite filmsku večer s nasumično odabranim filmom.", category: "zabava", difficulty: "easy" },
  { text: "Vsak drugemu pripravi 5-minutno presenečenje.", textEn: "Each prepare a 5-minute surprise for the other.", textHr: "Svako neka pripremi 5-minutno iznenađenje za drugo.", category: "presenecenja", difficulty: "easy" },
  { text: "Skupaj si oglejta sončni zahod.", textEn: "Watch a sunset together.", textHr: "Zajedno pogledajte zalazak sunca.", category: "romantika", difficulty: "easy" },
  { text: "Naredita domači spa večer.", textEn: "Have a spa night at home.", textHr: "Priredite spa večer kod kuće.", category: "wellness", difficulty: "easy" },
  { text: "Igrajta karte.", textEn: "Play a card game.", textHr: "Igrajte karte.", category: "zabava", difficulty: "easy" },
  { text: "Vsak pove svojo najbolj smešno zgodbo iz otroštva.", textEn: "Each tell your funniest childhood story.", textHr: "Svako neka ispriča svoju najsmješniju priču iz djetinjstva.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita skupni playlist s 10 pesmimi.", textEn: "Make a shared playlist of 10 songs.", textHr: "Napravite zajedničku playlistu od 10 pjesama.", category: "kreativnost", difficulty: "easy" },
  { text: "Pojdita na sprehod po delu mesta, kjer še nista bila.", textEn: "Walk through a part of town you've never explored.", textHr: "Prošetajte dijelom grada gdje još niste bili.", category: "narava", difficulty: "medium" },
  { text: "Skupaj specita sladico.", textEn: "Bake a dessert together.", textHr: "Zajedno ispecite kolač.", category: "aktivnost", difficulty: "medium" },
  { text: "Naredi partnerju kompliment, ki ga še nikoli nisi uporabil/a.", textEn: "Give your partner a compliment you've never used before.", textHr: "Daj partneru kompliment koji nikad prije nisi upotrijebio/upotrijebila.", category: "komunikacija", difficulty: "easy" },
  { text: "Za 30 minut pospravita telefone in samo klepetajta.", textEn: "Put your phones away for 30 minutes and just talk.", textHr: "Odložite mobitele na 30 minuta i samo razgovarajte.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj ustvarita novo interno šalo.", textEn: "Come up with a new inside joke together.", textHr: "Zajedno smislite novu unutarnju šalu.", category: "kreativnost", difficulty: "easy" },
  { text: "Naredita tekmovanje v risanju drug drugega.", textEn: "Have a drawing contest, sketching each other.", textHr: "Priredite natjecanje u crtanju jedno drugoga.", category: "kreativnost", difficulty: "easy" },
  { text: "Vsak izbere eno stvar, ki jo bosta danes naredila skupaj.", textEn: "Each pick one thing to do together today.", textHr: "Svako neka izabere jednu stvar koju ćete danas raditi zajedno.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Skupaj si pripravita najljubšo sladico.", textEn: "Make your favorite dessert together.", textHr: "Zajedno pripremite najdraži kolač.", category: "aktivnost", difficulty: "easy" },
  { text: "Naredita »mini roadtrip« brez konkretnega cilja.", textEn: "Take a mini road trip with no fixed destination.", textHr: "Priredite \"mini road trip\" bez određenog cilja.", category: "nacrtovanje", difficulty: "medium" },
  { text: "Igrajta »Kdo me bolje pozna?« z 10 vprašanji.", textEn: "Play \"Who knows me better?\" with 10 questions.", textHr: "Igrajte \"Tko me bolje poznaje?\" s 10 pitanja.", category: "komunikacija", difficulty: "easy" },
  { text: "Vsak napiše en spomin, ki ga nikoli ne želi pozabiti.", textEn: "Each write down one memory you never want to forget.", textHr: "Svako neka zapiše jednu uspomenu koju nikad ne želi zaboraviti.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita skupni bucket list.", textEn: "Make a shared bucket list.", textHr: "Napravite zajednički popis želja (bucket list).", category: "nacrtovanje", difficulty: "easy" },
  { text: "Skupaj si oglejta vajin najljubši film iz otroštva.", textEn: "Watch your favorite childhood movie together.", textHr: "Zajedno pogledajte svoj najdraži film iz djetinjstva.", category: "romantika", difficulty: "easy" },
  { text: "Naredi partnerju zajtrk v postelji.", textEn: "Make your partner breakfast in bed.", textHr: "Pripremi partneru doručak u krevet.", category: "romantika", difficulty: "easy" },
  { text: "Pojdita na sladoled.", textEn: "Go get ice cream.", textHr: "Idite na sladoled.", category: "romantika", difficulty: "easy" },
  { text: "Vsak izbere eno novo stvar, ki jo bosta poskusila.", textEn: "Each pick one new thing to try.", textHr: "Svako neka izabere jednu novu stvar koju ćete probati.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Naredita 5-minutni objem brez govorjenja.", textEn: "Share a 5-minute hug without talking.", textHr: "Zagrlite se 5 minuta bez razgovora.", category: "wellness", difficulty: "easy" },
  { text: "Skupaj pripravita koktajl ali mocktail.", textEn: "Make a cocktail or mocktail together.", textHr: "Zajedno pripremite koktel ili mocktail.", category: "aktivnost", difficulty: "easy" },
  { text: "Naredita večer »brez pravil« in pustita drugemu izbrati aktivnosti.", textEn: "Have a \"no rules\" evening and let the other choose the activities.", textHr: "Priredite večer \"bez pravila\" i pustite drugoga da bira aktivnosti.", category: "zabava", difficulty: "easy" },
  { text: "Vsak pove eno stvar, ki jo pri drugem občuduje.", textEn: "Each share one thing you admire about the other.", textHr: "Svako neka kaže jednu stvar kojoj se divi kod drugoga.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj si oglejta fotografije s prvega obdobja zveze.", textEn: "Look through photos from early in your relationship.", textHr: "Zajedno pregledajte fotografije s početka veze.", category: "romantika", difficulty: "easy" },
  { text: "Pojdita na spontano kavo.", textEn: "Go for a spontaneous coffee.", textHr: "Idite na spontanu kavu.", category: "romantika", difficulty: "easy" },
  { text: "Naredita mini tekmovanje v plesu.", textEn: "Have a mini dance-off.", textHr: "Priredite mini plesno natjecanje.", category: "zabava", difficulty: "easy" },
  { text: "Skupaj napišita seznam 20 krajev, ki jih želita obiskati.", textEn: "Write a list of 20 places you want to visit.", textHr: "Napišite popis 20 mjesta koja želite posjetiti.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Drug drugemu izberita oblačilo za večer.", textEn: "Pick each other's outfit for the evening.", textHr: "Izaberite jedno drugome odjeću za večer.", category: "zabava", difficulty: "easy" },
  { text: "Skupaj pripravita domačo pico.", textEn: "Make a homemade pizza together.", textHr: "Zajedno pripremite domaću pizzu.", category: "aktivnost", difficulty: "medium" },
  { text: "Naredita večer družabnih iger.", textEn: "Have a board game night.", textHr: "Priredite večer društvenih igara.", category: "zabava", difficulty: "easy" },
  { text: "Vsak drugemu pove eno stvar, ki jo želi izboljšati pri sebi.", textEn: "Each tell the other one thing you want to improve about yourself.", textHr: "Svako neka kaže drugome jednu stvar koju želi poboljšati kod sebe.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj se naučita novo besedo v tujem jeziku.", textEn: "Learn a new word in a foreign language together.", textHr: "Zajedno naučite novu riječ na stranom jeziku.", category: "kreativnost", difficulty: "easy" },
  { text: "Naredita fotografijo, ki bi jo čez 10 let rada videla.", textEn: "Take a photo you'd love to look back on in 10 years.", textHr: "Napravite fotografiju koju biste voljeli gledati za 10 godina.", category: "kreativnost", difficulty: "easy" },
  { text: "Pojdita na večerni sprehod.", textEn: "Go for an evening walk.", textHr: "Idite na večernju šetnju.", category: "narava", difficulty: "easy" },
  { text: "Vsak pripravi tri vprašanja za partnerja.", textEn: "Each prepare three questions for your partner.", textHr: "Svako neka pripremi tri pitanja za partnera.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj napišita svojo idealno prihodnost čez 5 let.", textEn: "Write down your ideal future together, 5 years from now.", textHr: "Zajedno opišite svoju idealnu budućnost za 5 godina.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Naredita »blind taste test« s tremi živili.", textEn: "Do a blind taste test with three foods.", textHr: "Priredite \"blind taste test\" s tri namirnice.", category: "zabava", difficulty: "easy" },
  { text: "Skupaj pripravita zajtrk za naslednje jutro.", textEn: "Prep breakfast together for tomorrow morning.", textHr: "Zajedno pripremite doručak za sutra ujutro.", category: "aktivnost", difficulty: "easy" },
  { text: "Izberita naključno restavracijo in jo obiščita.", textEn: "Pick a random restaurant and go visit it.", textHr: "Izaberite nasumičan restoran i posjetite ga.", category: "romantika", difficulty: "medium" },
  { text: "Vsak pove eno stvar, zaradi katere se počuti ljubljeno.", textEn: "Each share one thing that makes you feel loved.", textHr: "Svako neka kaže jednu stvar zbog koje se osjeća voljeno.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita 10-minutno raztezanje skupaj.", textEn: "Do 10 minutes of stretching together.", textHr: "Zajedno odradite 10 minuta istezanja.", category: "wellness", difficulty: "easy" },
  { text: "Skupaj si oglejta smešne videe in izberita najboljšega.", textEn: "Watch funny videos together and pick the best one.", textHr: "Zajedno pogledajte smiješne videe i izaberite najbolji.", category: "zabava", difficulty: "easy" },
  { text: "Vsak drugemu napiše eno stvar, ki jo je danes cenil.", textEn: "Each write the other one thing you appreciated today.", textHr: "Svako neka napiše drugome jednu stvar koju je danas cijenio/cijenila.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita večer, kjer vsak izbere eno pesem in pove, zakaj jo ima rad.", textEn: "Have an evening where each of you picks a song and explains why you love it.", textHr: "Priredite večer u kojem svako izabere pjesmu i kaže zašto je voli.", category: "romantika", difficulty: "easy" },
  { text: "Skupaj pripravita presenečenje za nekoga drugega.", textEn: "Prepare a surprise for someone else together.", textHr: "Zajedno pripremite iznenađenje za nekog drugog.", category: "presenecenja", difficulty: "medium" },
  { text: "Pojdita na zmenek brez načrtovanja.", textEn: "Go on a date with no planning at all.", textHr: "Idite na spoj bez ikakvog planiranja.", category: "romantika", difficulty: "easy" },
  { text: "Skupaj naredita nekaj, česar se oba malo bojita.", textEn: "Do something together that you're both a little afraid of.", textHr: "Zajedno napravite nešto čega se oboje pomalo bojite.", category: "presenecenja", difficulty: "hard" },
  { text: "Naredita mini fotoshooting drug drugega.", textEn: "Do a mini photoshoot of each other.", textHr: "Priredite mini fotografiranje jedno drugoga.", category: "kreativnost", difficulty: "easy" },
  { text: "Skupaj sestavita puzzle.", textEn: "Put together a puzzle together.", textHr: "Zajedno slažite puzzle.", category: "zabava", difficulty: "medium" },
  { text: "Vsak pove svojo najbolj čudno navado.", textEn: "Each share your weirdest habit.", textHr: "Svako neka kaže svoju najčudniju naviku.", category: "komunikacija", difficulty: "easy" },
  { text: "Skupaj pripravita jed iz druge države.", textEn: "Cook a dish from another country together.", textHr: "Zajedno pripremite jelo iz druge zemlje.", category: "aktivnost", difficulty: "medium" },
  { text: "Naredita večer, kjer sta telefona v drugem prostoru.", textEn: "Have an evening with your phones in another room.", textHr: "Priredite večer u kojem su mobiteli u drugoj prostoriji.", category: "narava", difficulty: "easy" },
  { text: "Drug drugemu izberita najljubšo sladkarijo.", textEn: "Pick each other's favorite treat.", textHr: "Izaberite jedno drugome najdražu slasticu.", category: "zabava", difficulty: "easy" },
  { text: "Skupaj napišita 5 stvari, ki jih želita letos narediti.", textEn: "Write down 5 things you want to do this year.", textHr: "Napišite 5 stvari koje želite učiniti ove godine.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Naredita tekmovanje: kdo pripravi boljši sendvič?", textEn: "Have a contest: who makes the better sandwich?", textHr: "Priredite natjecanje: tko pravi bolji sendvič?", category: "aktivnost", difficulty: "easy" },
  { text: "Skupaj si oglejta zvezde.", textEn: "Go stargazing together.", textHr: "Zajedno promatrajte zvijezde.", category: "romantika", difficulty: "easy" },
  { text: "Vsak pove eno stvar, ki jo želi, da bi skupaj počela pogosteje.", textEn: "Each share one thing you wish you did together more often.", textHr: "Svako neka kaže jednu stvar koju želi da radimo zajedno češće.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita »throwback night« z glasbo iz najstniških let.", textEn: "Have a throwback night with music from your teenage years.", textHr: "Priredite \"throwback\" večer s glazbom iz tinejdžerskih godina.", category: "zabava", difficulty: "easy" },
  { text: "Skupaj obiščita novo kavarno.", textEn: "Visit a new café together.", textHr: "Zajedno posjetite novi kafić.", category: "romantika", difficulty: "easy" },
  { text: "Vsak drugemu pove eno stvar, ki jo je pri njem opazil danes.", textEn: "Each tell the other one thing you noticed about them today.", textHr: "Svako neka kaže drugome jednu stvar koju je danas primijetio/primijetila kod njega.", category: "komunikacija", difficulty: "easy" },
  { text: "Naredita skupni seznam najljubših spominov.", textEn: "Make a shared list of your favorite memories.", textHr: "Napravite zajednički popis najdražih uspomena.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Skupaj se naučita en nov plesni gib.", textEn: "Learn a new dance move together.", textHr: "Zajedno naučite novi plesni pokret.", category: "kreativnost", difficulty: "easy" },
  { text: "Pripravita si večerjo ob svečah.", textEn: "Have a candlelit dinner.", textHr: "Priredite večeru uz svijeće.", category: "romantika", difficulty: "easy" },
  { text: "Vsak drugemu izbere majhno darilo do 5 €.", textEn: "Pick each other a small gift under €5.", textHr: "Izaberite jedno drugome mali poklon do 5 €.", category: "presenecenja", difficulty: "easy" },
  { text: "Skupaj si izmislita nov ritual, ki ga bosta ponavljala vsak teden.", textEn: "Come up with a new weekly ritual together.", textHr: "Zajedno smislite novi tjedni ritual.", category: "nacrtovanje", difficulty: "easy" },
  { text: "Vsak pove eno stvar, ki jo želi doživeti z drugim v naslednjem letu.", textEn: "Each share one thing you want to experience with the other next year.", textHr: "Svako neka kaže jednu stvar koju želi doživjeti s drugim iduće godine.", category: "komunikacija", difficulty: "easy" },
  { text: "Dan zaključita z dolgim objemom in vsak pove eno stvar, za katero je hvaležen za drugega.", textEn: "End the day with a long hug and each share one thing you're grateful for about the other.", textHr: "Završite dan dugim zagrljajem i svako neka kaže jednu stvar za koju je zahvalan/zahvalna drugome.", category: "wellness", difficulty: "easy" },
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
  website?: string;
  tags?: string[];
  lat?: number;
  lng?: number;
}> = [
  // Doma
  { title: "Kuhanje novega recepta", description: "Izbrajta si recept, ki ga še nista poskusila, in ga skupaj pripravita.", category: "doma", cost: "eur", duration: "1h" },
  { title: "Virtualni obisk muzeja", description: "Odpri Google Arts & Culture in izbrajta muzej, ki bi ga rada obiskala — od Louvra do Van Gogha.", category: "doma", cost: "brezplacno", duration: "1h", website: "https://artsandculture.google.com" },
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
  // Splošne ideje brez vezane lokacije — delujejo kjer koli, ne samo v Ljubljani.
  // Namenoma brez "city", da jih "Presenetí me" lahko predlaga vsem uporabnikom.
  { title: "Piknik na balkonu ali terasi", description: "Postelita odejo, pripravita prigrizke in uživajta v večeru na svežem zraku doma.", category: "doma", cost: "brezplacno", duration: "1h" },
  { title: "Skupno pisanje zgodbe", description: "Vsak izmenoma napiše en stavek in skupaj ustvarita smešno ali romantično zgodbo.", category: "doma", cost: "brezplacno", duration: "30min" },
  { title: "Degustacija doma", description: "Pripravita majhno degustacijo sirov, čokolad ali vin, ki jih še nista poskusila.", category: "doma", cost: "eur", duration: "1h" },
  { title: "Karaoke večer", description: "Izberita najljubše pesmi in zapojta na glas, kot da vaju nihče ne posluša.", category: "doma", cost: "brezplacno", duration: "1h" },
  { title: "Sprehod v bližnjem parku", description: "Poiščita najbližji park ali zeleno površino in se sprostita ob sprehodu.", category: "na-prostem", cost: "brezplacno", duration: "1h" },
  { title: "Kolesarjenje po okolici", description: "Odkrijta nove kolesarske poti v svoji okolici.", category: "na-prostem", cost: "brezplacno", duration: "2h" },
  { title: "Opazovanje zvezd", description: "Poiščita temno mesto stran od mestnih luči in opazujta nočno nebo.", category: "na-prostem", cost: "brezplacno", duration: "1h" },
  { title: "Piknik v naravi", description: "Vzemita odejo in malico ter poiščita lepo mesto v naravi za piknik.", category: "na-prostem", cost: "eur", duration: "2h+" },
  { title: "Tek ali hitra hoja skupaj", description: "Preteczita ali prehoditva svojo najljubšo traso v okolici.", category: "aktivno", cost: "brezplacno", duration: "1h" },
  { title: "Joga v dvoje", description: "Poiščita spletno vadbo joge za pare in jo skupaj preizkusita.", category: "aktivno", cost: "brezplacno", duration: "1h" },
  { title: "Obisk bližnjega plezalnega centra", description: "Preizkusita se v športnem plezanju v najbližjem plezalnem centru.", category: "aktivno", cost: "eur2", duration: "2h" },
  { title: "Kolesarski izlet", description: "Odpravita se na daljši kolesarski izlet v okolico.", category: "aktivno", cost: "brezplacno", duration: "2h+" },
  { title: "Kava v novi kavarni", description: "Poiščita kavarno v svoji bližini, ki je še nista obiskala.", category: "sprosceno", cost: "eur", duration: "30min" },
  { title: "Nakupovalni popoldan", description: "Sproščen dan brskanja po trgovinah v svojem mestu, brez pritiska po nakupu.", category: "sprosceno", cost: "eur2", duration: "2h" },
  { title: "Sladoled v bližini", description: "Poiščita najboljšo sladoledarno v svoji okolici.", category: "sprosceno", cost: "eur", duration: "30min" },
  { title: "Obisk lokalnega muzeja ali galerije", description: "Preverita, kateri muzej ali galerija je v vajini bližini, in jo obiščita skupaj.", category: "kulturno", cost: "eur", duration: "2h" },
  { title: "Ogled predstave v lokalnem gledališču", description: "Preverita repertoar najbližjega gledališča in si izberita predstavo.", category: "kulturno", cost: "eur2", duration: "2h+" },
  { title: "Obisk lokalne knjižnice", description: "Poiščita si knjigo v svoji mestni knjižnici, ki jo bosta prebrala vsak zase ali na glas.", category: "kulturno", cost: "brezplacno", duration: "1h" },
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
  const existingIdeasByTitle = new Map(existingIdeas.map((i: { title: string }) => [i.title, i]));
  const missingIdeas = DATE_IDEAS.filter((idea) => !existingIdeasByTitle.has(idea.title));
  if (missingIdeas.length > 0) {
    await db.insert(dateIdeas).values(missingIdeas as any);
    console.log(`[seed] Inserted ${missingIdeas.length} date ideas`);
  }
  // "Virtualni obisk muzeja" used to be a generic idea with nowhere to go —
  // backfill the pointer + updated description onto the existing row.
  const virtualMuseum = DATE_IDEAS.find((i) => i.title === "Virtualni obisk muzeja")!;
  const existingVirtualMuseum = existingIdeasByTitle.get(virtualMuseum.title) as typeof dateIdeas.$inferSelect | undefined;
  if (existingVirtualMuseum && !existingVirtualMuseum.website) {
    await db
      .update(dateIdeas)
      .set({ website: virtualMuseum.website, description: virtualMuseum.description })
      .where(eq(dateIdeas.id, existingVirtualMuseum.id));
  }
}

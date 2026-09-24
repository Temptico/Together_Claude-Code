// Push notification body text, localized to the recipient's language —
// notifications are sent based on the recipient's own `language` field, not
// the sender's, so a partner reading in English never sees Slovenian text.

type Lang = "sl" | "en" | "hr";

function normLang(lang: string): Lang {
  return lang === "en" || lang === "hr" ? lang : "sl";
}

const MOOD_LABELS: Record<Lang, Record<number, string>> = {
  sl: { 1: "zelo slabo", 2: "žalostno", 3: "v redu", 4: "dobro", 5: "odlično" },
  en: { 1: "very bad", 2: "sad", 3: "okay", 4: "good", 5: "great" },
  hr: { 1: "vrlo loše", 2: "tužno", 3: "u redu", 4: "dobro", 5: "odlično" },
};

export function moodNotification(lang: string, level: number): string {
  const l = normLang(lang);
  const label = MOOD_LABELS[l][level] || "";
  const bodies: Record<Lang, string> = {
    sl: `Tvoj partner se danes počuti ${label}! 🌟`,
    en: `Your partner is feeling ${label} today! 🌟`,
    hr: `Tvoj partner se danas osjeća ${label}! 🌟`,
  };
  return bodies[l];
}

export function answerNotification(lang: string): string {
  const bodies: Record<Lang, string> = {
    sl: "Partner je odgovoril na današnje vprašanje. Preveri odgovor.",
    en: "Your partner answered today's question. Check it out.",
    hr: "Partner je odgovorio na današnje pitanje. Provjeri odgovor.",
  };
  return bodies[normLang(lang)];
}

export function challengeNotification(lang: string): string {
  const bodies: Record<Lang, string> = {
    sl: "Partner je dokončal današnji izziv! 🏆",
    en: "Your partner completed today's challenge! 🏆",
    hr: "Partner je dovršio današnji izazov! 🏆",
  };
  return bodies[normLang(lang)];
}

export function reactionNotification(lang: string, emoji: string): string {
  const bodies: Record<Lang, string> = {
    sl: `Partner se je odzval/a z ${emoji}`,
    en: `Your partner reacted with ${emoji}`,
    hr: `Partner je reagirao/la s ${emoji}`,
  };
  return bodies[normLang(lang)];
}

export function planDateNotification(lang: string, title: string): string {
  const bodies: Record<Lang, string> = {
    sl: `Partner je predlagal/a nov zmenek: ${title} 💌`,
    en: `Your partner planned a new date: ${title} 💌`,
    hr: `Partner je predložio/la novi spoj: ${title} 💌`,
  };
  return bodies[normLang(lang)];
}

export function dailyReminderNotification(lang: string): string {
  const bodies: Record<Lang, string> = {
    sl: "Ne pozabi izbrati današnjega razpoloženja! 💗",
    en: "Don't forget to pick today's mood! 💗",
    hr: "Ne zaboravi odabrati današnje raspoloženje! 💗",
  };
  return bodies[normLang(lang)];
}

export function anniversaryNotification(lang: string, years: number): string {
  const l = normLang(lang);
  if (years <= 0) {
    return { sl: "Danes je vajina obletnica! 💕", en: "Today is your anniversary! 💕", hr: "Danas je vaša godišnjica! 💕" }[l];
  }
  const bodies: Record<Lang, string> = {
    sl: `Danes je vajina ${years}. obletnica! 💕`,
    en: `Today is your ${years}${years === 1 ? "st" : years === 2 ? "nd" : years === 3 ? "rd" : "th"} anniversary! 💕`,
    hr: `Danas je vaša ${years}. godišnjica! 💕`,
  };
  return bodies[l];
}

export function anniversaryUpcomingNotification(lang: string, daysUntil: 30 | 14): string {
  const bodies: Record<Lang, Record<30 | 14, string>> = {
    sl: {
      30: "Vajina obletnica je čez mesec dni — čas je za načrtovanje! 💕",
      14: "Vajina obletnica je čez 14 dni! 💕",
    },
    en: {
      30: "Your anniversary is a month away — time to start planning! 💕",
      14: "Your anniversary is in 14 days! 💕",
    },
    hr: {
      30: "Vaša godišnjica je za mjesec dana — vrijeme je za planiranje! 💕",
      14: "Vaša godišnjica je za 14 dana! 💕",
    },
  };
  return bodies[normLang(lang)][daysUntil];
}

// Sent to the partner of the person whose birthday it is.
export function partnerBirthdayNotification(lang: string, name: string, daysUntil: 14 | 0): string {
  const bodies: Record<Lang, Record<14 | 0, string>> = {
    sl: {
      14: `Čez 14 dni ima ${name} rojstni dan — še je dovolj časa za darilo 🎁`,
      0: `Danes ima ${name} rojstni dan! 🎂 Poskrbi, da bo dan poseben.`,
    },
    en: {
      14: `${name}'s birthday is in 14 days — still plenty of time for a gift 🎁`,
      0: `It's ${name}'s birthday today! 🎂 Make it a special one.`,
    },
    hr: {
      14: `Za 14 dana ${name} ima rođendan — još ima vremena za poklon 🎁`,
      0: `Danas ${name} ima rođendan! 🎂 Pobrini se da dan bude poseban.`,
    },
  };
  return bodies[normLang(lang)][daysUntil];
}

export function ownBirthdayNotification(lang: string): string {
  const bodies: Record<Lang, string> = {
    sl: "Vse najboljše za rojstni dan! 🎂💕",
    en: "Happy birthday! 🎂💕",
    hr: "Sretan rođendan! 🎂💕",
  };
  return bodies[normLang(lang)];
}

export function photoAddedNotification(lang: string, title: string): string {
  const bodies: Record<Lang, string> = {
    sl: `Partner je dodal/a fotografijo k zmenku: ${title} 📸`,
    en: `Your partner added a photo to your date: ${title} 📸`,
    hr: `Partner je dodao/la fotografiju spoju: ${title} 📸`,
  };
  return bodies[normLang(lang)];
}

export function streakFreezeNotification(lang: string, streak: number): string {
  const bodies: Record<Lang, string> = {
    sl: `🔥 Tvoj niz ${streak} dni bo prekinjen, če danes ne opravita vsaj ene aktivnosti!`,
    en: `🔥 Your ${streak}-day streak will end if you don't complete at least one activity today!`,
    hr: `🔥 Tvoj niz od ${streak} dana će se prekinuti ako danas ne obavite barem jednu aktivnost!`,
  };
  return bodies[normLang(lang)];
}

export function challengeUnfinishedNotification(lang: string): string {
  const bodies: Record<Lang, string> = {
    sl: "Danes sprejeti izziv še čaka — dokončajta ga, preden se dan izteče! 🏆",
    en: "Today's accepted challenge is still open — finish it before the day's out! 🏆",
    hr: "Danas prihvaćeni izazov još čeka — dovršite ga prije kraja dana! 🏆",
  };
  return bodies[normLang(lang)];
}

export function connectReminderNotification(lang: string): string {
  const bodies: Record<Lang, string> = {
    sl: "Ne pozabi povabiti partnerja/ko! Tvoja koda za povezavo te čaka. 💕",
    en: "Don't forget to invite your partner! Your connect code is waiting. 💕",
    hr: "Ne zaboravi pozvati partnera/icu! Tvoj kod za povezivanje te čeka. 💕",
  };
  return bodies[normLang(lang)];
}

export function dateReminder3dNotification(lang: string, title: string): string {
  const bodies: Record<Lang, string> = {
    sl: `Čez 3 dni imata zmenek: ${title} 💕`,
    en: `Your date is in 3 days: ${title} 💕`,
    hr: `Za 3 dana imate spoj: ${title} 💕`,
  };
  return bodies[normLang(lang)];
}

export function dateReminderTodayNotification(lang: string, title: string): string {
  const bodies: Record<Lang, string> = {
    sl: `Danes imata zmenek: ${title}! 💕`,
    en: `Your date is today: ${title}! 💕`,
    hr: `Danas imate spoj: ${title}! 💕`,
  };
  return bodies[normLang(lang)];
}

export function milestoneNotification(lang: string, days: number): string {
  const bodies: Record<Lang, string> = {
    sl: `🎉 ${days} dni zapored! Odprita Together in praznujta ta mejnik.`,
    en: `🎉 ${days} days in a row! Open Together and celebrate this milestone.`,
    hr: `🎉 ${days} dana zaredom! Otvorite Together i proslavite ovu prekretnicu.`,
  };
  return bodies[normLang(lang)];
}

// Game names (e.g. "Never Have I Ever") are always shown in English
// regardless of app language — that's how people recognize the game — only
// the surrounding sentence is localized.
export function gameStartedNotification(lang: string, gameName: string): string {
  const bodies: Record<Lang, string> = {
    sl: `Partner je začel igro ${gameName} — pridruži se! 🎮`,
    en: `Your partner started a round of ${gameName} — join in! 🎮`,
    hr: `Partner je pokrenuo igru ${gameName} — pridruži se! 🎮`,
  };
  return bodies[normLang(lang)];
}

export function gameCompletedNotification(lang: string, gameName: string): string {
  const bodies: Record<Lang, string> = {
    sl: `Oba sta odgovorila na ${gameName} — poglej primerjavo! 🎮`,
    en: `You've both finished ${gameName} — check out your results! 🎮`,
    hr: `Oboje ste odgovorili na ${gameName} — pogledaj usporedbu! 🎮`,
  };
  return bodies[normLang(lang)];
}

// One-off announcement for the Games feature launch, sent via the admin
// dashboard's broadcast tool — short by design, the email covers detail.
export function gamesAnnouncementNotification(lang: string): string {
  const bodies: Record<Lang, string> = {
    sl: "Novo v aplikaciji: Igre! 🎮 Preizkusita Never Have I Ever, This or That in več.",
    en: "New in the app: Games! 🎮 Try Never Have I Ever, This or That, and more.",
    hr: "Novo u aplikaciji: Igre! 🎮 Isprobajte Never Have I Ever, This or That i više.",
  };
  return bodies[normLang(lang)];
}

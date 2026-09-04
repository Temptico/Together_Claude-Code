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

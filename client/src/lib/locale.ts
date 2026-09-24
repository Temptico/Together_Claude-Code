import type { Language } from "@/i18n/translations";

const LOCALE_MAP: Record<Language, string> = {
  sl: "sl-SI",
  en: "en-US",
  hr: "hr-HR",
};

export function bcp47(lang: Language): string {
  return LOCALE_MAP[lang] || "sl-SI";
}

// YYYY-MM-DD in the device's own time zone — toISOString() is UTC, which
// between midnight and 02:00 in Slovenia still says "yesterday".
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

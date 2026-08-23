import type { Language } from "@/i18n/translations";

const LOCALE_MAP: Record<Language, string> = {
  sl: "sl-SI",
  en: "en-US",
  hr: "hr-HR",
};

export function bcp47(lang: Language): string {
  return LOCALE_MAP[lang] || "sl-SI";
}

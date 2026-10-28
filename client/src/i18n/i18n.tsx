import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Language } from "./translations";

const STORAGE_KEY = "together:lang";

function get(obj: any, path: string) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

type I18nContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const SUPPORTED_LANGUAGES: Language[] = ["sl", "en", "hr"];

// The active language, readable outside React (query client error toasts).
let currentLang: Language = "sl";

export function translate(key: string): string {
  const value = get(translations[currentLang], key);
  if (typeof value === "string") return value;
  const fallback = get(translations.sl, key);
  return typeof fallback === "string" ? fallback : key;
}

function detectDeviceLanguage(): Language {
  const candidates = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const primary = candidate?.slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(primary as Language)) return primary as Language;
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "sl" || stored === "hr") return stored;
    return detectDeviceLanguage();
  });

  const setLang = (l: Language) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  currentLang = lang;
  useEffect(() => {
    // Screen readers and browser translation pick their voice/behaviour
    // from this; index.html hardcodes "sl".
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: string) => {
    const value = get(translations[lang], key);
    if (typeof value === "string") return value;
    const fallback = get(translations.sl, key);
    return typeof fallback === "string" ? fallback : key;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}

import { createContext, useContext, useState, type ReactNode } from "react";
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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "sl" || stored === "hr" ? stored : "sl";
  });

  const setLang = (l: Language) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

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

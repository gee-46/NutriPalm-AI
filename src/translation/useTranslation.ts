/**
 * useTranslation.ts
 *
 * Usage:
 *   const { t, lang, setLang } = useTranslation();
 *   t('nav.home')  // → "Home" | "ಮುಖಪುಟ"
 *
 * Falls back to English + console.warn in development when a Kannada key is
 * missing. Never throws.
 */
import enStrings from "./translations/en.json";
import knStrings from "./translations/kn.json";
import { useLanguage } from "./LanguageContext";

type TranslationMap = Record<string, string>;
type Vars = Record<string, string | number>;

/** BCP-47 locales used for dates and number grouping. */
export const LOCALES: Record<string, string> = { en: "en-IN", kn: "kn-IN" };

export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

const translations: Record<string, TranslationMap> = {
  en: enStrings as TranslationMap,
  kn: knStrings as TranslationMap,
};

export function useTranslation() {
  const { lang, setLang } = useLanguage();
  const map = translations[lang] ?? translations["en"];

  /** t(key), t(key, "default"), t(key, {name: "x"}) or t(key, "default", {name: "x"}); "{name}" tokens are replaced. */
  function t(key: string, second?: string | Vars, third?: Vars): string {
    const defaultValue = typeof second === "string" ? second : undefined;
    const vars = typeof second === "object" ? second : third;
    return interpolate(lookup(key, defaultValue), vars);
  }

  function lookup(key: string, defaultValue?: string): string {
    if (key in map) return map[key];

    // Fall back to English
    if (lang !== "en" && key in translations["en"]) {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing Kannada key: "${key}" — falling back to EN`);
      }
      return translations["en"][key];
    }

    if (import.meta.env.DEV) {
      console.warn(`[i18n] Unknown translation key: "${key}"`);
    }
    return defaultValue ?? key; // last resort: show default or the key itself
  }

  /** Like t(), but silent: returns `fallback` when the key has no entry (for data-driven strings that may have no translation). */
  function tOptional(key: string, fallback: string): string {
    return key in map ? map[key] : fallback;
  }

  return { t, tOptional, lang, setLang, locale: LOCALES[lang] ?? LOCALES.en };
}

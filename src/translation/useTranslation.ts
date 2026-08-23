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

const translations: Record<string, TranslationMap> = {
  en: enStrings as TranslationMap,
  kn: knStrings as TranslationMap,
};

export function useTranslation() {
  const { lang, setLang } = useLanguage();
  const map = translations[lang] ?? translations["en"];

  function t(key: string): string {
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
    return key; // last resort: show the key itself
  }

  return { t, lang, setLang };
}

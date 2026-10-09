/**
 * LanguageContext.tsx
 *
 * Provides { lang, setLang } to the whole React tree.
 * English is the default. The choice is remembered in localStorage under
 * LANGUAGE_STORAGE_KEY so it survives navigation and refresh (it is a device
 * preference, not account data, so logout deliberately keeps it).
 * Sets document.documentElement.lang on every change for a11y tools
 * and to scope the Kannada font fallback in CSS (html[lang="kn"]).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Lang = "en" | "kn";

/** The only languages offered in this phase. */
export const SUPPORTED_LANGS: readonly Lang[] = ["en", "kn"];
export const LANGUAGE_STORAGE_KEY = "nutripalm_lang";

export function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return v === "kn" || v === "en" ? v : "en";
  } catch {
    return "en"; // storage blocked: fall back to the default
  }
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => undefined,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  // Sync html[lang] on every change for a11y tools and CSS font scoping
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (!SUPPORTED_LANGS.includes(next)) return;
    setLangState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice still applies for this session
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => useContext(LanguageContext);

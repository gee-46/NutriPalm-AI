/**
 * LanguageContext.tsx
 *
 * Provides { lang, setLang } to the whole React tree.
 * Language lives in React state ONLY — no localStorage.
 * Every fresh page load always starts in English.
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
  // Always starts as English — no localStorage read
  const [lang, setLangState] = useState<Lang>("en");

  // Sync html[lang] on every change for a11y tools and CSS font scoping
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => useContext(LanguageContext);

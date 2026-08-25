import React from "react";
import { useLanguage } from "./LanguageContext";

/**
 * LanguageToggle component
 * 
 * NOTE: The "EN" and "ಕನ್ನಡ" labels are deliberately hardcoded and NOT 
 * wrapped in the t() translation function. This is because this component
 * controls the translation system itself, and its own labels should not
 * depend on the translation system being loaded correctly.
 */
export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useLanguage();

  const handleToggle = () => {
    const nextLang = lang === "en" ? "kn" : "en";
    setLang(nextLang);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={lang === "kn"}
      aria-label={lang === "en" ? "Switch to Kannada" : "ಇಂಗ್ಲಿಷ್‌ಗೆ ಬದಲಾಯಿಸಿ (Switch to English)"}
      className="relative flex items-center w-16 h-8 bg-emerald-100 rounded-full p-1 cursor-pointer transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {/* Background slider pill */}
      <div
        className={`absolute top-1 left-1 w-7 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${
          lang === "kn" ? "translate-x-7" : "translate-x-0"
        }`}
      />
      
      {/* English Label */}
      <div
        className={`absolute left-0 w-8 text-center text-[10px] font-bold z-10 transition-colors duration-300 ${
          lang === "en" ? "text-primary" : "text-emerald-700/60"
        }`}
      >
        EN
      </div>

      {/* Kannada Label */}
      <div
        className={`absolute right-0 w-8 text-center text-[10px] font-bold z-10 transition-colors duration-300 ${
          lang === "kn" ? "text-primary" : "text-emerald-700/60"
        }`}
      >
        ಕನ್ನಡ
      </div>
    </button>
  );
};

/**
 * LanguageToggle.tsx
 *
 * A two-state toggle switch: EN ↔ ಕನ್ನಡ
 *
 * Accessibility:
 *  - role="switch" + aria-checked reflects current state
 *  - aria-label describes the action in both languages
 *  - Focusable via Tab, activatable via Enter / Space
 *
 * Design:
 *  - Uses existing design-system tokens from index.css / Tailwind config
 *    (--color-primary #2E7D32, --color-secondary #66BB6A, rounded-xl, etc.)
 *  - Fixed min-width so toggling never shifts adjacent nav items
 *  - Active locale shown with: background fill + bold weight + underline
 *    (3 distinct cues so colorblind users can always tell state)
 */
import React from "react";
import { useTranslation } from "./useTranslation";

interface LanguageToggleProps {
  /** Optional extra className for positioning in different layout contexts */
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  className = "",
}) => {
  const { t, lang, setLang } = useTranslation();

  const isKannada = lang === "kn";

  const toggle = () => setLang(isKannada ? "en" : "kn");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  // aria-label changes with state so screen readers announce the *action*
  const ariaLabel = isKannada
    ? t("lang.toggle_label") // "ಇಂಗ್ಲಿಷ್‌ಗೆ ಬದಲಿಸಿ"
    : t("lang.toggle_label"); // "Switch to Kannada"

  return (
    <button
      id="language-toggle"
      role="switch"
      aria-checked={isKannada}
      aria-label={ariaLabel}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={`
        lang-toggle
        inline-flex items-center
        rounded-lg border border-gray-200
        bg-white/70
        p-0.5
        gap-0
        cursor-pointer
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-primary
        focus-visible:ring-offset-2
        transition-all duration-200
        hover:border-primary/40
        hover:shadow-sm
        ${className}
      `}
      style={{ minWidth: "5.5rem" }}
    >
      {/* EN segment */}
      <span
        aria-hidden="true"
        className={`
          lang-toggle__segment
          px-2.5 py-1
          rounded-md
          text-xs leading-none
          select-none
          transition-all duration-200
          ${
            !isKannada
              ? // ACTIVE English state
                "font-bold underline underline-offset-2 decoration-2 text-white bg-primary shadow-sm"
              : // INACTIVE
                "font-medium text-gray-500 hover:text-gray-700"
          }
        `}
      >
        {t("lang.en")}
      </span>

      {/* KN segment */}
      <span
        aria-hidden="true"
        className={`
          lang-toggle__segment
          px-2.5 py-1
          rounded-md
          text-xs leading-none
          select-none
          transition-all duration-200
          ${
            isKannada
              ? // ACTIVE Kannada state
                "font-bold underline underline-offset-2 decoration-2 text-white bg-primary shadow-sm"
              : // INACTIVE
                "font-medium text-gray-500 hover:text-gray-700"
          }
        `}
        style={{
          // Noto Sans Kannada is loaded via html[lang="kn"] in CSS;
          // here we always render the Kannada label with a Kannada-safe fallback
          fontFamily: "'Noto Sans Kannada', 'Geist', system-ui, sans-serif",
        }}
      >
        {t("lang.kn")}
      </span>
    </button>
  );
};

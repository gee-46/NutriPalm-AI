# NutriPalm AI — i18n (Language Toggle)

## Overview

The app supports **English (EN)** and **Kannada (ಕನ್ನಡ)** via a custom
lightweight i18n system — no external library required.

---

## How it works

```
src/i18n/
├── LanguageContext.tsx      # Context provider: { lang, setLang }
├── useTranslation.ts        # Hook: const { t, lang, setLang } = useTranslation()
├── LanguageToggle.tsx       # Toggle button component
└── translations/
    ├── en.json              # English strings
    └── kn.json              # Kannada strings
```

1. `LanguageProvider` wraps the entire app in `src/main.tsx`.
2. On load it reads `localStorage["nutripalm_lang"]` — defaults to `"en"`.
3. Every `setLang()` call: updates React state → persists to localStorage →
   sets `document.documentElement.lang` to `"en"` or `"kn"`.
4. The CSS rule `html[lang="kn"] { font-family: 'Noto Sans Kannada' ... }` in
   `src/index.css` is activated automatically by step 3.

---

## How to use translations in a component

```tsx
import { useTranslation } from "../translation/useTranslation";

export function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t("nav.home")}</h1>; // → "Home" | "ಮುಖಪುಟ"
}
```

---

## How to add a new translatable string

1. Pick a namespaced key, e.g. `"hero.title"`.
2. Add it to **both** translation files:

**`src/i18n/translations/en.json`**
```json
{
  "hero.title": "Digital Twins for every farm."
}
```

**`src/i18n/translations/kn.json`**
```json
{
  "hero.title": "ಪ್ರತಿ ಕ್ಷೇತ್ರಕ್ಕೆ ಡಿಜಿಟಲ್ ಟ್ವಿನ್."
}
```

3. Use `t("hero.title")` in the component.

> If a Kannada key is **missing**, the hook falls back to English and logs a
> `console.warn` in development — no crash, no visible raw key.

---

## Toggle button

`<LanguageToggle />` is placed in:
- **Desktop nav** — `src/components/Navbar.tsx` (right of nav links)
- **Mobile menu** — same file, inside the mobile drawer

It is keyboard-accessible (`Tab` to focus, `Enter`/`Space` to toggle),
uses `role="switch"` + `aria-checked`, and has a dynamic `aria-label`
that announces the *action* in the current language.

---

## Files modified in this feature branch

| File | Change |
|---|---|
| `src/main.tsx` | Wrapped `<App>` in `<LanguageProvider>` |
| `src/components/Navbar.tsx` | Added `<LanguageToggle>`, nav labels use `t()` |
| `src/index.css` | Added Noto Sans Kannada import + `html[lang="kn"]` scope rule |

---

## Files skipped (actively owned by other contributors)

| File | Reason |
|---|---|
| `src/components/prototype/DigitalTwinScreen.tsx` | Recent commits from teammate |
| `src/components/prototype/FarmPlotScreen.tsx` | Recent commits from teammate |
| `src/data/plots.ts` | Recent commits from teammate |
| `src/lib/geo.ts` | Recently added by teammate |
| `src/components/prototype/AnalyticsScreen.tsx` | Recent refactor commit |
| `src/components/prototype/LeafletMapPicker.tsx` | Recently added by teammate |
| `src/data/digitalTwins.ts` | Recently added by teammate |

---

## Adding a new language

1. Create `src/i18n/translations/<code>.json` with all keys.
2. Add `"<code>": <imported json>` to the `translations` map in `useTranslation.ts`.
3. Update `LanguageContext.tsx` — extend the `Lang` type.
4. Add an extra `lang` segment in `LanguageToggle.tsx`.
5. Add a scoped font rule in `index.css` if the language requires a different script.

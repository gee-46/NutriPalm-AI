// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import en from "../translation/translations/en.json";
import kn from "../translation/translations/kn.json";
import { interpolate, LOCALES } from "../translation/useTranslation";
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGS, readStoredLang } from "../translation/LanguageContext";
import { weatherConditionKey } from "../lib/weatherText";

const E = en as Record<string, string>;
const K = kn as Record<string, string>;

// All app source as text, without touching the filesystem API (keeps the test type-safe in the browser tsconfig).
const SOURCES = import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../__tests__/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const tokens = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
const hasKannada = (s: string) => /[ಀ-೿]/.test(s);

describe("translation resources", () => {
  it("English and Kannada define exactly the same keys", () => {
    expect(Object.keys(K).sort()).toEqual(Object.keys(E).sort());
  });

  it("every literal t('key') used in the app exists in both languages", () => {
    const used = new Set<string>();
    for (const src of Object.values(SOURCES)) {
      for (const m of src.matchAll(/\bt\(\s*["']([a-z][\w.]*(?: [\w]+)*)["']/g)) used.add(m[1]);
    }
    const missing = [...used].filter((k) => !(k in E) || !(k in K));
    expect(missing).toEqual([]);
  });

  it("{placeholders} are identical in English and Kannada for every key", () => {
    const bad = Object.keys(E).filter((k) => tokens(E[k]) !== tokens(K[k]));
    expect(bad).toEqual([]);
  });

  it("every Phase 2 string is really translated into Kannada script (not left in English)", () => {
    // Script-neutral on purpose: product names, standards, placeholders-only strings.
    const neutral = /^p2\.(ui\.(ndvi|wgs_84|sentinel_2_ndvi|vite_google|aizasy)|dash\.next_item$)/;
    const untranslated = Object.keys(E).filter((k) => k.startsWith("p2.") && !neutral.test(k) && !hasKannada(K[k]));
    expect(untranslated).toEqual([]);
  });

  it("only English and Kannada are offered", () => {
    expect([...SUPPORTED_LANGS]).toEqual(["en", "kn"]);
    expect(Object.keys(LOCALES).sort()).toEqual(["en", "kn"]);
  });
});

describe("interpolate", () => {
  it("replaces known tokens and leaves unknown ones", () => {
    expect(interpolate("Hi {name}, {n} plots {x}", { name: "Asha", n: 3 })).toBe("Hi Asha, 3 plots {x}");
    expect(interpolate("plain")).toBe("plain");
  });
});

describe("language persistence", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to English", () => {
    expect(readStoredLang()).toBe("en");
  });
  it("restores a stored Kannada choice", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "kn");
    expect(readStoredLang()).toBe("kn");
  });
  it("ignores unsupported stored values (e.g. a language removed from this phase)", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "hi");
    expect(readStoredLang()).toBe("en");
  });
});

describe("weather condition text", () => {
  it("maps WMO codes to translation keys that exist in both languages", () => {
    for (const code of [0, 1, 3, 45, 51, 61, 71, 80, 95, 999, null]) {
      const key = weatherConditionKey(code as number | null);
      expect(E[key], key).toBeTruthy();
      expect(K[key], key).toBeTruthy();
    }
  });
});

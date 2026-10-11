// @vitest-environment jsdom
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../translation/LanguageContext";
import { useTranslation } from "../translation/useTranslation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Regression test. `t` used to be re-created on every render. Many screens list `t` in an effect's dependency
 * array (e.g. "load data when t changes"), so every render re-ran the effect, whose result set state, which
 * rendered again: an endless loop of network requests. `t` must keep its identity until the language changes.
 */
describe("useTranslation identity", () => {
  it("returns the same t / tOptional across re-renders and a new one only when the language changes", async () => {
    const seen: Array<{ t: unknown; tOptional: unknown; lang: string }> = [];
    let bump!: () => void;
    let change!: (l: "en" | "kn") => void;
    const Probe: React.FC = () => {
      const { t, tOptional, lang, setLang } = useTranslation();
      const [n, setN] = useState(0);
      bump = () => setN((x) => x + 1);
      change = setLang;
      seen.push({ t, tOptional, lang });
      return <span>{n}</span>;
    };
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<LanguageProvider><Probe /></LanguageProvider>));
    await act(async () => bump());
    await act(async () => bump());
    expect(new Set(seen.map((s) => s.t)).size).toBe(1);
    expect(new Set(seen.map((s) => s.tOptional)).size).toBe(1);
    await act(async () => change("kn"));
    expect(seen.at(-1)!.t).not.toBe(seen[0].t);
    await act(async () => root.unmount());
  });

  it("an effect that depends on t runs once per language, not once per render", async () => {
    let runs = 0;
    let bump!: () => void;
    const Probe: React.FC = () => {
      const { t } = useTranslation();
      const [n, setN] = useState(0);
      bump = () => setN((x) => x + 1);
      useEffect(() => {
        runs += 1;
      }, [t]);
      return <span>{n}</span>;
    };
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<LanguageProvider><Probe /></LanguageProvider>));
    for (let i = 0; i < 5; i++) await act(async () => bump());
    expect(runs).toBe(1);
    await act(async () => root.unmount());
  });
});

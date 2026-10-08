// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("googleMapsLoader", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    document.head.innerHTML = "";
    window.localStorage.clear();
    delete (window as any).google;
  });

  it("is optional: rejects with a clear code when no key is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const { loadGoogleMaps, getGoogleMapsApiKey } = await import("../lib/googleMapsLoader");
    expect(getGoogleMapsApiKey()).toBe("");
    await expect(loadGoogleMaps()).rejects.toThrow("GOOGLE_MAPS_API_KEY_MISSING");
    expect(document.querySelector("script")).toBeNull();
  });

  it("resolves to the google namespace (callers use google.maps.Map)", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    const { loadGoogleMaps } = await import("../lib/googleMapsLoader");
    const pending = loadGoogleMaps();
    const script = document.querySelector("script") as HTMLScriptElement;
    expect(script.src).toContain("callback=__googleMapsCallback__");
    (window as any).google = { maps: { Map: function () {} } };
    (window as any).__googleMapsCallback__();
    const ns = await pending;
    expect(ns).toBe((window as any).google);
    expect(typeof ns.maps.Map).toBe("function");
  });

  it("rejects and allows a retry when the script fails to load", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    const { loadGoogleMaps } = await import("../lib/googleMapsLoader");
    const first = loadGoogleMaps();
    (document.querySelector("script") as HTMLScriptElement).onerror?.(new Event("error"));
    await expect(first).rejects.toThrow(/Failed to load/);
    document.head.innerHTML = "";
    const second = loadGoogleMaps();
    expect(document.querySelector("script")).not.toBeNull();
    (window as any).google = { maps: { Map: function () {} } };
    (window as any).__googleMapsCallback__();
    await expect(second).resolves.toBeDefined();
  });

  it("never logs the API key", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "super-secret-key");
    const spies = (["log", "warn", "error", "info", "debug"] as const).map((m) => vi.spyOn(console, m));
    const { getGoogleMapsApiKey } = await import("../lib/googleMapsLoader");
    getGoogleMapsApiKey();
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toContain("super-secret-key");
    }
  });
});

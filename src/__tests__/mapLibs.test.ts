// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PROVIDER, escapeHtml, resolveMapConfig } from "../lib/mapConfig";
import { LocationError, acquireLocation, checkLocationSupport, type LocationEnv } from "../lib/geolocation";
import { watchTileHealth } from "../lib/tileHealth";

// ------------------------------------------------------------------------------------------------ map configuration
describe("resolveMapConfig: exactly one configured imagery provider", () => {
  it("uses Esri World Imagery with the service's own attribution by default outside production", () => {
    const r = resolveMapConfig({}, { production: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.provider).toBe("Esri World Imagery");
    expect(r.config.tileUrl).toBe(DEFAULT_PROVIDER.tileUrl);
    expect(r.config.attribution).toContain("Esri");
    expect(r.config.attribution).toContain("Earthstar Geographics");
    expect(r.config.maxNativeZoom).toBe(18);
    expect(r.config.isDefaultProvider).toBe(true);
  });

  it("loads NO imagery in production until the owner confirms the provider's terms", () => {
    const r = resolveMapConfig({}, { production: true });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problem).toBe("license_unconfirmed");
    expect(r.message).toMatch(/VITE_MAP_LICENSE_CONFIRMED=true/);
    expect(resolveMapConfig({ VITE_MAP_LICENSE_CONFIRMED: "false" }, { production: true }).ok).toBe(false);
    expect(resolveMapConfig({ VITE_MAP_LICENSE_CONFIRMED: "TRUE" }, { production: true }).ok).toBe(true);
  });

  it("a custom provider needs its name and attribution; nothing is assumed", () => {
    const url = "https://tiles.example.org/{z}/{x}/{y}.jpg";
    expect(resolveMapConfig({ VITE_MAP_TILE_URL: url }, { production: false })).toMatchObject({ ok: false, problem: "invalid_config" });
    expect(resolveMapConfig({ VITE_MAP_TILE_URL: url, VITE_MAP_PROVIDER_NAME: "Example" }, { production: false })).toMatchObject({ ok: false, problem: "invalid_config" });
    const ok = resolveMapConfig({ VITE_MAP_TILE_URL: url, VITE_MAP_PROVIDER_NAME: "Example", VITE_MAP_ATTRIBUTION: "© Example" }, { production: false });
    expect(ok.ok && ok.config.provider).toBe("Example");
    expect(ok.ok && ok.config.isDefaultProvider).toBe(false);
  });

  it("validates the URL: placeholders, https, and the API key slot", () => {
    const base = { VITE_MAP_PROVIDER_NAME: "P", VITE_MAP_ATTRIBUTION: "A" };
    const bad = (extra: Record<string, string>) => resolveMapConfig({ ...base, ...extra }, { production: false });
    expect(resolveMapConfig({ ...base, VITE_MAP_TILE_URL: "https://t.example/{z}/{x}.jpg" }, { production: false })).toMatchObject({ ok: false });
    expect(resolveMapConfig({ ...base, VITE_MAP_TILE_URL: "http://t.example/{z}/{x}/{y}.jpg" }, { production: false })).toMatchObject({ ok: false });
    expect(resolveMapConfig({ ...base, VITE_MAP_TILE_URL: "http://localhost:8080/{z}/{x}/{y}.jpg" }, { production: false }).ok).toBe(true);
    expect(resolveMapConfig({ ...base, VITE_MAP_TILE_URL: "http://localhost:8080/{z}/{x}/{y}.jpg", VITE_MAP_LICENSE_CONFIRMED: "true" }, { production: true })).toMatchObject({ ok: false }); // http not allowed in production
    expect(bad({ VITE_MAP_TILE_URL: "https://t.example/{z}/{x}/{y}.jpg?key={apiKey}" })).toMatchObject({ ok: false, problem: "invalid_config", message: expect.stringContaining("VITE_MAP_API_KEY is not set") }); // slot but no key
    expect(resolveMapConfig({ ...base, VITE_MAP_TILE_URL: "https://t.example/{z}/{x}/{y}.jpg", VITE_MAP_API_KEY: "k" }, { production: false })).toMatchObject({ ok: false }); // key but no slot
    const keyed = resolveMapConfig({ ...base, VITE_MAP_TILE_URL: "https://t.example/{z}/{x}/{y}.jpg?key={apiKey}", VITE_MAP_API_KEY: "a b&c" }, { production: false });
    expect(keyed.ok && keyed.config.tileUrl).toBe("https://t.example/{z}/{x}/{y}.jpg?key=a%20b%26c");
  });

  it("rejects settings that would silently do nothing, and a bad native zoom", () => {
    expect(resolveMapConfig({ VITE_MAP_API_KEY: "k" }, { production: false })).toMatchObject({ ok: false, problem: "invalid_config" });
    expect(resolveMapConfig({ VITE_MAP_MAX_NATIVE_ZOOM: "99" }, { production: false })).toMatchObject({ ok: false });
    expect(resolveMapConfig({ VITE_MAP_MAX_NATIVE_ZOOM: "19" }, { production: false }).ok).toBe(true);
  });

  it("escapes attribution text before it can reach the page", () => {
    expect(escapeHtml(`<img src=x onerror="a()"> & 'q'`)).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;q&#39;");
  });
});

// ------------------------------------------------------------------------------------------------ geolocation
type WatchCb = (pos: GeolocationPosition) => void;
type ErrCb = (err: GeolocationPositionError) => void;

function fakeDevice(opts: { secure?: boolean } = {}) {
  let success: WatchCb = () => {};
  let failure: ErrCb = () => {};
  let clock = 1_000_000;
  const timers: Array<{ at: number; fn: () => void; id: number; live: boolean }> = [];
  let nextId = 1;
  const watchArgs: PositionOptions[] = [];
  const cleared: number[] = [];
  const env: LocationEnv = {
    geolocation: {
      watchPosition: (s, f, o) => {
        success = s;
        failure = f as ErrCb;
        watchArgs.push(o as PositionOptions);
        return 7;
      },
      clearWatch: (id) => cleared.push(id),
    },
    isSecureContext: opts.secure ?? true,
    now: () => clock,
    setTimeout: ((fn: () => void, ms: number) => {
      const t = { at: clock + ms, fn, id: nextId++, live: true };
      timers.push(t);
      return t.id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeout: ((id: number) => {
      const t = timers.find((x) => x.id === id);
      if (t) t.live = false;
    }) as unknown as typeof clearTimeout,
  };
  const pos = (accuracy: number, atOffsetMs = 0, lat = 17.2473, lng = 80.1514) =>
    ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: clock + atOffsetMs }) as GeolocationPosition;
  const err = (code: 1 | 2 | 3) => ({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" }) as GeolocationPositionError;
  return {
    env,
    watchArgs,
    cleared,
    emit: (p: GeolocationPosition) => success(p),
    fail: (code: 1 | 2 | 3) => failure(err(code)),
    pos,
    advance: (ms: number) => {
      clock += ms;
      for (const t of timers.filter((x) => x.live && x.at <= clock)) {
        t.live = false;
        t.fn();
      }
    },
  };
}

describe("checkLocationSupport", () => {
  it("reports unsupported environments and insecure origins", () => {
    expect(checkLocationSupport({ geolocation: null })).toMatchObject({ code: "unsupported" });
    expect(checkLocationSupport({ geolocation: undefined })).toMatchObject({ code: "unsupported" });
    expect(checkLocationSupport({ geolocation: fakeDevice().env.geolocation, isSecureContext: false })).toMatchObject({ code: "insecure_context" });
    expect(checkLocationSupport({ geolocation: fakeDevice().env.geolocation, isSecureContext: true })).toBeNull();
  });
});

describe("acquireLocation", () => {
  it("asks for a fresh, high-accuracy fix with no cached position and a finite timeout", () => {
    const d = fakeDevice();
    acquireLocation({ windowMs: 10000 }, d.env);
    expect(d.watchArgs[0]).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  });

  it("resolves at once with a reading within the target accuracy and reports it in metres", async () => {
    const d = fakeDevice();
    const seen: number[] = [];
    const req = acquireLocation({ targetAccuracyM: 30, onReading: (f) => seen.push(f.accuracyM) }, d.env);
    d.emit(d.pos(120));
    d.emit(d.pos(12));
    const fix = await req.promise;
    expect(fix.accuracyM).toBe(12);
    expect(fix.lat).toBeCloseTo(17.2473);
    expect(seen).toEqual([120, 12]);
    expect(d.cleared).toEqual([7]); // the watch is stopped
  });

  it("keeps the most accurate reading and settles for it when the window ends", async () => {
    const d = fakeDevice();
    const req = acquireLocation({ windowMs: 10000 }, d.env);
    d.emit(d.pos(400));
    d.emit(d.pos(90));
    d.emit(d.pos(250));
    d.advance(10000);
    expect((await req.promise).accuracyM).toBe(90);
  });

  it("ignores a stale (cached) position from before the request", async () => {
    const d = fakeDevice();
    const req = acquireLocation({ windowMs: 10000, staleToleranceMs: 5000 }, d.env);
    d.emit(d.pos(5, -60_000)); // excellent accuracy, but a minute old: a cached fix
    d.emit(d.pos(80));
    d.advance(10000);
    expect((await req.promise).accuracyM).toBe(80);
  });

  it("reports an out-of-date fix (not a plain timeout) when every reading is stamped before the request", async () => {
    const d = fakeDevice();
    const req = acquireLocation({ windowMs: 10000, staleToleranceMs: 5000 }, d.env);
    d.emit(d.pos(5, -60_000));
    d.advance(10000);
    await expect(req.promise).rejects.toMatchObject({ name: "LocationError", code: "stale_fix" });
  });

  it("classifies permission denied, unavailable and timeout", async () => {
    for (const [code, expected] of [[1, "permission_denied"], [2, "unavailable"], [3, "timeout"]] as const) {
      const d = fakeDevice();
      const req = acquireLocation({}, d.env);
      d.fail(code);
      await expect(req.promise).rejects.toMatchObject({ name: "LocationError", code: expected });
    }
  });

  it("times out with a timeout error when no reading ever arrives", async () => {
    const d = fakeDevice();
    const req = acquireLocation({ windowMs: 10000 }, d.env);
    d.advance(10000);
    await expect(req.promise).rejects.toMatchObject({ code: "timeout" });
  });

  it("does not fail after a reading exists: an error then lets the window decide", async () => {
    const d = fakeDevice();
    const req = acquireLocation({ windowMs: 10000 }, d.env);
    d.emit(d.pos(70));
    d.fail(3);
    d.advance(10000);
    expect((await req.promise).accuracyM).toBe(70);
  });

  it("rejects at once when location is unsupported or the origin is insecure", async () => {
    await expect(acquireLocation({}, { geolocation: null }).promise).rejects.toMatchObject({ code: "unsupported" });
    const d = fakeDevice({ secure: false });
    await expect(acquireLocation({}, d.env).promise).rejects.toMatchObject({ code: "insecure_context" });
    expect(d.watchArgs).toHaveLength(0); // never asks for permission on an insecure origin
  });

  it("can be retried: a second request after a failure starts a new watch and can succeed", async () => {
    const d = fakeDevice();
    const first = acquireLocation({}, d.env);
    d.fail(3);
    await expect(first.promise).rejects.toBeInstanceOf(LocationError);
    const second = acquireLocation({}, d.env);
    d.emit(d.pos(15));
    expect((await second.promise).accuracyM).toBe(15);
    expect(d.watchArgs).toHaveLength(2);
  });

  it("ignores non-finite readings and a cancelled request never settles", async () => {
    const d = fakeDevice();
    const req = acquireLocation({}, d.env);
    d.emit(d.pos(Number.NaN));
    d.emit(d.pos(Infinity));
    req.cancel();
    d.emit(d.pos(5));
    const settled = vi.fn();
    req.promise.then(settled, settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(d.cleared).toContain(7);
  });
});

// ------------------------------------------------------------------------------------------------ tile health
function fakeLayer() {
  const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
  const redraw = vi.fn();
  return {
    layer: {
      on: (t: string, fn: (...a: unknown[]) => void) => void (handlers[t] ??= []).push(fn),
      off: (t: string, fn: (...a: unknown[]) => void) => void (handlers[t] = (handlers[t] ?? []).filter((x) => x !== fn)),
      redraw,
    },
    fire: (t: string) => (handlers[t] ?? []).forEach((fn) => fn()),
    count: (t: string) => (handlers[t] ?? []).length,
    redraw,
  };
}

describe("watchTileHealth", () => {
  it("flags failure when tiles fail and none load, and recovers on its own when tiles load", () => {
    const f = fakeLayer();
    const states: boolean[] = [];
    watchTileHealth(f.layer, (x) => states.push(x));
    f.fire("loading");
    f.fire("tileerror"); f.fire("tileerror");
    expect(states).toEqual([]); // below the threshold
    f.fire("tileerror");
    expect(states).toEqual([true]);
    f.fire("loading");
    f.fire("tileload");
    expect(states).toEqual([true, false]);
  });

  it("does not flag a view where tiles load, even with an occasional error", () => {
    const f = fakeLayer();
    const states: boolean[] = [];
    watchTileHealth(f.layer, (x) => states.push(x));
    f.fire("loading");
    f.fire("tileload"); f.fire("tileerror"); f.fire("tileerror"); f.fire("tileerror");
    f.fire("load");
    expect(states).toEqual([]);
  });

  it("flags a small view where every tile failed when the layer finishes loading", () => {
    const f = fakeLayer();
    const states: boolean[] = [];
    watchTileHealth(f.layer, (x) => states.push(x));
    f.fire("loading");
    f.fire("tileerror");
    f.fire("load");
    expect(states).toEqual([true]);
  });

  it("retry asks the SAME layer to redraw, clears the error, and never touches another provider", () => {
    const f = fakeLayer();
    const states: boolean[] = [];
    const health = watchTileHealth(f.layer, (x) => states.push(x));
    f.fire("loading"); f.fire("tileerror"); f.fire("tileerror"); f.fire("tileerror");
    health.retry();
    expect(f.redraw).toHaveBeenCalledTimes(1);
    expect(states).toEqual([true, false]);
  });

  it("dispose removes every listener", () => {
    const f = fakeLayer();
    const health = watchTileHealth(f.layer, () => {});
    expect(["loading", "tileload", "tileerror", "load"].map(f.count)).toEqual([1, 1, 1, 1]);
    health.dispose();
    expect(["loading", "tileload", "tileerror", "load"].map(f.count)).toEqual([0, 0, 0, 0]);
  });
});

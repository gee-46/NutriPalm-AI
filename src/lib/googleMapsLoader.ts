/**
 * googleMapsLoader.ts
 *
 * Optional loader for the Google Maps JavaScript API. Google Maps is never
 * required: when no key is configured, or loading fails, callers fall back to
 * the Leaflet/Esri satellite engine.
 *
 * IMPORTANT: `loadGoogleMaps()` resolves to the global `google` namespace
 * (so callers write `google.maps.Map`), NOT to `google.maps`.
 *
 * The key comes from VITE_GOOGLE_MAPS_API_KEY (or a developer override kept in
 * localStorage). It is never logged.
 */

declare global {
  interface Window {
    google: any;
    [key: string]: any;
  }
}

const OVERRIDE_STORAGE_KEY = "NUTRIPALM_GOOGLE_MAPS_API_KEY";
const CALLBACK_NAME = "__googleMapsCallback__";
const LOAD_TIMEOUT_MS = 15000;

let loadPromise: Promise<any> | null = null;

export function getGoogleMapsApiKey(): string {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }
  try {
    if (typeof window !== "undefined") {
      const localKey = window.localStorage.getItem(OVERRIDE_STORAGE_KEY);
      if (localKey && localKey.trim().length > 0) return localKey.trim();
    }
  } catch {
    // localStorage can be unavailable (private mode, blocked storage)
  }
  return "";
}

/** Store/remove a temporary developer key override and force a fresh load. */
export function setGoogleMapsApiKeyOverride(apiKey: string): void {
  if (typeof window === "undefined") return;
  try {
    if (apiKey.trim()) {
      window.localStorage.setItem(OVERRIDE_STORAGE_KEY, apiKey.trim());
    } else {
      window.localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures; the override simply won't persist
  }
  loadPromise = null;
}

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== "undefined" && !!window.google?.maps?.Map;
}

export function loadGoogleMaps(apiKeyOverride?: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in a browser environment."));
  }

  if (isGoogleMapsLoaded()) {
    return Promise.resolve(window.google);
  }

  const key = apiKeyOverride?.trim() || getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("GOOGLE_MAPS_API_KEY_MISSING"));
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const fail = (message: string) => {
      loadPromise = null;
      delete window[CALLBACK_NAME];
      reject(new Error(message));
    };

    const timer = window.setTimeout(
      () => fail("Google Maps did not load in time. Check your network connection and API key restrictions."),
      LOAD_TIMEOUT_MS
    );

    const done = () => {
      window.clearTimeout(timer);
      if (isGoogleMapsLoaded()) {
        delete window[CALLBACK_NAME];
        resolve(window.google);
      } else {
        fail("Google Maps script loaded but the maps library is unavailable.");
      }
    };

    // Another part of the app may already have inserted the script tag.
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener(
        "error",
        () => {
          window.clearTimeout(timer);
          fail("Failed to load the Google Maps script.");
        },
        { once: true }
      );
      return;
    }

    window[CALLBACK_NAME] = done;

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      `?key=${encodeURIComponent(key)}` +
      "&libraries=geometry,places" +
      `&callback=${CALLBACK_NAME}` +
      "&loading=async";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      fail(
        "Failed to load the Google Maps JavaScript API. Check your network connection, API key, " +
          "key restrictions and that the Maps JavaScript API is enabled."
      );
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

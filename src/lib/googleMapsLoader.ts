// src/lib/googleMapsLoader.ts

declare global {
  interface Window {
    google?: any;
    __googleMapsCallback__?: () => void;
  }
}

let loadPromise: Promise<any> | null = null;

/**
 * Get Google Maps API key from:
 * 1. Vite environment variable
 * 2. localStorage override
 */
export function getGoogleMapsApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;

  if (typeof envKey === "string" && envKey.trim().length > 0) {
    console.log("VITE GOOGLE MAP KEY EXISTS:", true);
    console.log("VITE GOOGLE MAP KEY LENGTH:", envKey.length);

    return envKey.trim();
  }

  if (typeof window !== "undefined") {
    const localKey = window.localStorage.getItem(
      "NUTRIPALM_GOOGLE_MAPS_API_KEY"
    );

    if (localKey && localKey.trim().length > 0) {
      console.log("Google Maps API key found in localStorage.");

      return localKey.trim();
    }
  }

  console.warn("Google Maps API key was not found.");

  return "";
}

/**
 * Store/remove temporary Google Maps API key override.
 */
export function setGoogleMapsApiKeyOverride(apiKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  if (apiKey.trim()) {
    window.localStorage.setItem(
      "NUTRIPALM_GOOGLE_MAPS_API_KEY",
      apiKey.trim()
    );
  } else {
    window.localStorage.removeItem(
      "NUTRIPALM_GOOGLE_MAPS_API_KEY"
    );
  }

  // Force the loader to try again with the new key.
  loadPromise = null;
}

/**
 * Check whether Google Maps JavaScript API is actually available.
 */
export function isGoogleMapsLoaded(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.google?.maps &&
    !!window.google.maps.Map
  );
}

/**
 * Load Google Maps JavaScript API.
 *
 * IMPORTANT:
 * This function returns `window.google`, NOT `window.google.maps`.
 *
 * The component uses:
 *   google.maps.Map
 *   google.maps.Polygon
 *   google.maps.Polyline
 *   google.maps.LatLng
 *   google.maps.places
 *
 * Therefore the returned object must be the full `google` object.
 */
export function loadGoogleMaps(
  apiKeyOverride?: string
): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error(
        "Google Maps can only be loaded in a browser environment."
      )
    );
  }

  // Already loaded.
  if (isGoogleMapsLoaded()) {
    console.log("Google Maps is already loaded.");

    // IMPORTANT:
    // Return window.google, not window.google.maps
    return Promise.resolve(window.google);
  }

  const key =
    apiKeyOverride?.trim() ||
    getGoogleMapsApiKey();

  if (!key) {
    return Promise.reject(
      new Error("GOOGLE_MAPS_API_KEY_MISSING")
    );
  }

  console.log("Google Maps API key found.");
  console.log("Loading Google Maps JavaScript API...");

  // Prevent multiple simultaneous script loads.
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    /**
     * Check if another part of the application has already
     * inserted the Google Maps script.
     */
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    ) as HTMLScriptElement | null;

    if (existingScript) {
      console.log(
        "Google Maps script already exists. Waiting for it..."
      );

      // It may already have loaded.
      if (isGoogleMapsLoaded()) {
        resolve(window.google);
        return;
      }

      const handleLoad = () => {
        if (isGoogleMapsLoaded()) {
          console.log(
            "Google Maps existing script loaded successfully."
          );

          resolve(window.google);
        } else {
          loadPromise = null;

          reject(
            new Error(
              "Google Maps script loaded but google.maps is unavailable."
            )
          );
        }
      };

      const handleError = () => {
        loadPromise = null;

        reject(
          new Error(
            "Failed to load Google Maps script."
          )
        );
      };

      existingScript.addEventListener(
        "load",
        handleLoad,
        { once: true }
      );

      existingScript.addEventListener(
        "error",
        handleError,
        { once: true }
      );

      return;
    }

    /**
     * Google Maps callback.
     */
    const callbackName = "__googleMapsCallback__";

    window[callbackName] = () => {
      console.log("Google Maps callback executed.");

      delete window[callbackName];

      if (isGoogleMapsLoaded()) {
        console.log(
          "Google Maps JavaScript API loaded successfully."
        );

        // IMPORTANT:
        // Return the full google object.
        resolve(window.google);
      } else {
        loadPromise = null;

        reject(
          new Error(
            "Google Maps callback executed but google.maps is undefined."
          )
        );
      }
    };

    /**
     * Create Google Maps script.
     */
    const script = document.createElement("script");

    script.type = "text/javascript";

    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      `?key=${encodeURIComponent(key)}` +
      "&libraries=geometry,places" +
      `&callback=${callbackName}` +
      "&loading=async";

    script.async = true;
    script.defer = true;

    /**
     * Script loading error.
     */
    script.onerror = () => {
      console.error(
        "Google Maps JavaScript API script failed to load."
      );

      delete window[callbackName];

      loadPromise = null;

      reject(
        new Error(
          "Failed to load Google Maps JavaScript API. " +
            "Please check your network connection, API key, " +
            "API restrictions, and enabled Google Maps APIs."
        )
      );
    };

    /**
     * Add script to document.
     */
    document.head.appendChild(script);
  });

  return loadPromise;
}
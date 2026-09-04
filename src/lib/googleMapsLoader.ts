/**
 * googleMapsLoader.ts
 *
 * Dedicated loader for the official Google Maps JavaScript API.
 * Dynamically injects the script tag with geometry and places libraries,
 * handles promise deduplication, and returns the global `google.maps` instance.
 */

declare global {
  interface Window {
    google?: any;
    __googleMapsCallback__?: () => void;
  }
}

let loadPromise: Promise<any> | null = null;

export function getGoogleMapsApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }
  // Check localStorage for temporary developer key override
  if (typeof window !== "undefined") {
    const localKey = window.localStorage.getItem("NUTRIPALM_GOOGLE_MAPS_API_KEY");
    if (localKey && localKey.trim().length > 0) {
      return localKey.trim();
    }
  }
  return "";
}

export function setGoogleMapsApiKeyOverride(apiKey: string): void {
  if (typeof window !== "undefined") {
    if (apiKey.trim()) {
      window.localStorage.setItem("NUTRIPALM_GOOGLE_MAPS_API_KEY", apiKey.trim());
    } else {
      window.localStorage.removeItem("NUTRIPALM_GOOGLE_MAPS_API_KEY");
    }
    // Reset loader promise so next load uses the new key
    loadPromise = null;
  }
}

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== "undefined" && !!window.google?.maps;
}

export function loadGoogleMaps(apiKeyOverride?: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in a browser environment."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  const key = apiKeyOverride || getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("GOOGLE_MAPS_API_KEY_MISSING"));
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        existingScript.addEventListener("load", () => resolve(window.google.maps));
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script.")));
      }
      return;
    }

    const callbackName = "__googleMapsCallback__";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=geometry,places&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      delete window[callbackName];
      loadPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API. Please check your network connection and API key."));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

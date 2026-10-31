/**
 * geolocation.ts - device location for the boundary survey, through the supported runtime API.
 *
 * Runtime path: the standard Geolocation API (navigator.geolocation). It works in a normal browser over HTTPS (and on localhost)
 * and in an Android WebView/TWA that grants it. This project has NO Capacitor/Cordova plugin and NO android/ project, so nothing
 * here claims native permissions are configured; see docs/MAPS_AND_LOCATION.md for the Android work that is still required.
 *
 * Behaviour: high accuracy, no cached fix (maximumAge 0, and a reading older than the request is ignored), a finite window, the
 * most accurate reading wins, and every failure is classified so the UI can say what happened and what to do.
 * A phone GPS fix is NOT survey-grade; this module reports the accuracy the device claims and nothing more.
 */

/** "stale_fix": readings arrived but every one was stamped before this request (a cached fix, or a device clock that is wrong). */
export type LocationErrorCode = "unsupported" | "insecure_context" | "permission_denied" | "unavailable" | "timeout" | "stale_fix";

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.name = "LocationError";
    this.code = code;
  }
}

export interface LocationFix {
  lat: number;
  lng: number;
  /** Radius in metres the device reports for this fix (68 % confidence per the Geolocation spec). */
  accuracyM: number;
  timestamp: number;
}

export interface LocationEnv {
  geolocation?: Pick<Geolocation, "watchPosition" | "clearWatch"> | null;
  isSecureContext?: boolean;
  now?: () => number;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

export interface AcquireOptions {
  /** Stop as soon as a reading is at least this accurate (metres). Default 30. */
  targetAccuracyM?: number;
  /** How long to keep looking for a better reading before settling for the best so far (ms). Default 10 000. */
  windowMs?: number;
  /** A reading older than the request by more than this is treated as a cached position and ignored (ms). Default 5 000. */
  staleToleranceMs?: number;
  /** Called for every accepted reading. */
  onReading?: (fix: LocationFix, isBest: boolean) => void;
}

export interface LocationRequest {
  promise: Promise<LocationFix>;
  cancel: () => void;
}

const browserEnv = (): LocationEnv => ({
  geolocation: typeof navigator !== "undefined" ? navigator.geolocation : undefined,
  isSecureContext: typeof window !== "undefined" ? window.isSecureContext : undefined,
});

/** Why location cannot even be attempted in this environment, or null. */
export function checkLocationSupport(env: LocationEnv = browserEnv()): LocationError | null {
  if (!env.geolocation) {
    return new LocationError("unsupported", "This device or browser does not provide location.");
  }
  if (env.isSecureContext === false) {
    return new LocationError("insecure_context", "Location is only available on a secure (HTTPS) connection.");
  }
  return null;
}

/** The browser's permission state for location, or "unknown" where the Permissions API is not available. */
export async function queryLocationPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

const toFix = (pos: GeolocationPosition, now: () => number): LocationFix => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracyM: pos.coords.accuracy,
  timestamp: pos.timestamp || now(),
});

/**
 * Ask the device for a fresh, high-accuracy fix. Resolves with the best reading found (immediately once one is within
 * targetAccuracyM, otherwise when the window ends). Rejects with a LocationError. Call cancel() to stop early; a cancelled
 * request never resolves or rejects.
 */
export function acquireLocation(options: AcquireOptions = {}, env: LocationEnv = browserEnv()): LocationRequest {
  const { targetAccuracyM = 30, windowMs = 10000, staleToleranceMs = 5000, onReading } = options;
  const now = env.now ?? Date.now;
  const setT = env.setTimeout ?? setTimeout;
  const clearT = env.clearTimeout ?? clearTimeout;

  let watchId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let best: LocationFix | null = null;
  let staleSeen = false;
  let settled = false;
  let cancelled = false;
  let resolveFn: (f: LocationFix) => void = () => {};
  let rejectFn: (e: LocationError) => void = () => {};

  const cleanup = () => {
    if (watchId !== null && env.geolocation) env.geolocation.clearWatch(watchId);
    watchId = null;
    if (timer !== null) clearT(timer);
    timer = null;
  };
  const finishOk = (fix: LocationFix) => {
    if (settled || cancelled) return;
    settled = true;
    cleanup();
    resolveFn(fix);
  };
  const finishErr = (err: LocationError) => {
    if (settled || cancelled) return;
    settled = true;
    cleanup();
    rejectFn(err);
  };

  const promise = new Promise<LocationFix>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const unsupported = checkLocationSupport(env);
  if (unsupported) {
    finishErr(unsupported);
    return { promise, cancel: () => {} };
  }

  const startedAt = now();

  timer = setT(() => {
    if (best) finishOk(best);
    else if (staleSeen) finishErr(new LocationError("stale_fix", "The device only returned an out-of-date location."));
    else finishErr(new LocationError("timeout", "The device did not return a location in time."));
  }, windowMs);

  try {
    watchId = env.geolocation!.watchPosition(
      (pos) => {
        const fix = toFix(pos, now);
        if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || !Number.isFinite(fix.accuracyM)) return;
        if (fix.timestamp < startedAt - staleToleranceMs) { // a cached position from before this request
          staleSeen = true;
          return;
        }
        const isBest = !best || fix.accuracyM < best.accuracyM;
        if (isBest) best = fix;
        onReading?.(fix, isBest);
        if (best && best.accuracyM <= targetAccuracyM) finishOk(best);
      },
      (err) => {
        if (best) return; // a reading already exists: let the window decide
        if (err.code === err.PERMISSION_DENIED) finishErr(new LocationError("permission_denied", "Location permission was denied."));
        else if (err.code === err.TIMEOUT) finishErr(new LocationError("timeout", "The device did not return a location in time."));
        else finishErr(new LocationError("unavailable", "The device could not determine its location."));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: windowMs }
    );
  } catch {
    finishErr(new LocationError("unavailable", "The device could not start location tracking."));
  }

  return {
    promise,
    cancel: () => {
      cancelled = true;
      cleanup();
    },
  };
}

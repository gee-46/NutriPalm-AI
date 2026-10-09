import { useEffect, useState } from "react";
import { getApiBaseUrl } from "./apiClient";

export type ApiHealth = "checking" | "online" | "offline";

/**
 * Real reachability of the FastAPI backend (GET /health), re-checked every minute.
 * Drives the header status pill so it never claims "online" without evidence.
 */
export function useApiHealth(intervalMs = 60000): ApiHealth {
  const [state, setState] = useState<ApiHealth>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${getApiBaseUrl()}/health`, { signal: controller.signal });
        if (!cancelled) setState(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setState("offline");
      } finally {
        clearTimeout(timer);
      }
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return state;
}

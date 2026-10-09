import { useEffect, useState } from "react";
import { probeBackendCapabilities, type BackendCapabilities } from "../lib/phase2/capabilities";

/** Which Phase 2 backend modules the running backend really publishes (read from its OpenAPI document). */
export function useBackendCapabilities(): BackendCapabilities {
  const [caps, setCaps] = useState<BackendCapabilities>({ disease: "checking", cropSuitability: "checking" });
  useEffect(() => {
    let cancelled = false;
    probeBackendCapabilities().then((c) => {
      if (!cancelled) setCaps(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return caps;
}

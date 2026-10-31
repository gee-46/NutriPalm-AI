import { useEffect, useState } from "react";
import { listExtractions } from "../lib/apiClient";
import type { OcrExtractedField, SoilReportUploadResponsePayload } from "../lib/apiClient";
import type { PdfReading } from "../lib/recommendationPdf";

const CORE = ["nitrogen", "phosphorus", "potassium", "ph", "organic_carbon", "electrical_conductivity"] as const;

/**
 * The values of one stored extraction as the pipeline read them, with the unit printed on the report and whether the owner
 * corrected them. A corrected value shows what was SAVED and keeps the original reading alongside it.
 * A parameter the report does not contain is listed as not found; it is never filled in.
 */
export function readingsFromExtraction(x: SoilReportUploadResponsePayload): PdfReading[] {
  const log = Array.isArray(x.corrections) ? x.corrections : [];
  const correction = (parameter: string) => log.find((c) => c && (c as { parameter?: unknown }).parameter === parameter) as
    | { corrected_value?: number; unit?: string | null; original_value?: number | string | null }
    | undefined;

  // The extraction is stored as it was READ. Once the report is verified, a value that was only "review" has been confirmed by the
  // owner (the backend refuses to save a required one otherwise); an optional one left out is listed in not_saved.
  const verified = x.status === "completed" && x.persisted;
  const notSaved = new Set(x.not_saved ?? []);

  const toReading = (f: OcrExtractedField, parameter: string): PdfReading => {
    const c = correction(parameter);
    if (c) {
      return {
        parameter,
        value: c.corrected_value ?? null,
        unit: c.unit ?? f.unit,
        validation: "valid",
        rawLabel: f.raw_label,
        corrected: true,
        originalValue: c.original_value ?? null,
      };
    }
    let validation: string = f.validation;
    if (verified && f.validation === "review") validation = notSaved.has(parameter) ? "not_saved" : "confirmed";
    return { parameter, value: f.value, unit: f.unit, validation, rawLabel: f.raw_label };
  };

  const out: PdfReading[] = [];
  for (const key of CORE) {
    const f = x[key];
    if (f) out.push(toReading(f, key));
  }
  // Micronutrients are listed only when the report actually contains them.
  for (const m of x.micronutrients ?? []) {
    if (m.value !== null && m.value !== undefined) out.push(toReading(m, m.parameter));
  }
  return out;
}

export interface ReportReadingsState {
  readings: PdfReading[];
  loading: boolean;
  /** The readings could not be loaded; the verified values themselves (from the database) are unaffected. */
  error: boolean;
}

/** Readings behind a verified soil report, or none when the extraction is not available (never a guess). */
export function useReportReadings(plotId: string | undefined, soilReportId: string | undefined, refreshKey: number | string = 0): ReportReadingsState {
  const [state, setState] = useState<ReportReadingsState>({ readings: [], loading: false, error: false });

  useEffect(() => {
    let cancelled = false;
    if (!plotId || !soilReportId) {
      setState({ readings: [], loading: false, error: false });
      return;
    }
    setState({ readings: [], loading: true, error: false });
    listExtractions(plotId)
      .then((list) => {
        if (cancelled) return;
        const match = list.find((x) => x.soil_report_id === soilReportId);
        setState({ readings: match ? readingsFromExtraction(match) : [], loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ readings: [], loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [plotId, soilReportId, refreshKey]);

  return state;
}

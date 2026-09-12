/**
 * Reads for the rr_* tables, plus the trigger for the compute-scores function.
 *
 * Hazard zones, safe sites and habitations are fetched once — the whole dataset
 * is 14 zones, 13 sites and 42 habitations — so Backtest Mode and the what-if
 * slider can re-derive from memory. Scores are fetched per dataset, because
 * rr_scores holds a separate row per (habitation_id, source).
 */

import { supabase } from "@/lib/supabase/client";
import type {
  DataSource,
  Habitation,
  HazardZone,
  SafeSite,
  Score,
} from "@/lib/supabase/types";

export interface BaseData {
  hazardZones: HazardZone[];
  safeSites: SafeSite[];
  habitations: Habitation[];
}

/**
 * Log the failing table, the exact column list, and the full PostgREST error
 * before throwing.
 *
 * A Supabase error object carries message/details/hint/code, and only `message`
 * survives into an Error — the other three are usually where the real cause is
 * (a missing column, an RLS denial, a bad filter). Printing the object keeps
 * that visible in the console instead of collapsing to a generic UI error.
 */
function reportQueryError(
  table: string,
  columns: string,
  error: {
    message: string;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
  },
): never {
  console.error(`[data] query failed on ${table}`, {
    table,
    columns,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    error,
  });

  const extra = [error.code && `code ${error.code}`, error.hint, error.details]
    .filter(Boolean)
    .join(" · ");

  throw new Error(
    `Reading ${table} failed: ${error.message}${extra ? ` (${extra})` : ""}`,
  );
}

const ZONE_COLUMNS =
  "id, geom, hazard_type, intensity, source, event_label, metadata, created_at";
const SITE_COLUMNS = "id, geom, name, capacity_max, infra_score, created_at";
const HABITATION_COLUMNS = "id, geom, name, population, created_at";
const SCORE_COLUMNS =
  "id, habitation_id, hazard_score, capacity_score, priority_rank, factor_breakdown, nearest_safe_site_id, source, computed_at";

export async function fetchBaseData(): Promise<BaseData> {
  const [zones, sites, habitations] = await Promise.all([
    supabase
      .from("rr_hazard_zones")
      .select(ZONE_COLUMNS)
      .order("intensity", { ascending: false }),
    supabase
      .from("rr_safe_sites")
      .select(SITE_COLUMNS)
      .order("capacity_max", { ascending: false }),
    supabase.from("rr_habitations").select(HABITATION_COLUMNS).order("name"),
  ]);

  // Reported per table so a single failing column list is identifiable.
  if (zones.error) reportQueryError("rr_hazard_zones", ZONE_COLUMNS, zones.error);
  if (sites.error) reportQueryError("rr_safe_sites", SITE_COLUMNS, sites.error);
  if (habitations.error) {
    reportQueryError("rr_habitations", HABITATION_COLUMNS, habitations.error);
  }

  const result = {
    hazardZones: zones.data ?? [],
    safeSites: sites.data ?? [],
    habitations: habitations.data ?? [],
  };

  console.info("[data] base tables loaded", {
    hazardZones: result.hazardZones.length,
    safeSites: result.safeSites.length,
    habitations: result.habitations.length,
  });

  return result;
}

/** Persisted scores for one hazard dataset, ordered by rank. */
export async function fetchScores(source: DataSource): Promise<Score[]> {
  const { data, error } = await supabase
    .from("rr_scores")
    .select(SCORE_COLUMNS)
    .eq("source", source)
    .order("priority_rank", { ascending: true });

  if (error) {
    reportQueryError(`rr_scores (source=${source})`, SCORE_COLUMNS, error);
  }

  console.info(`[data] rr_scores loaded for source=${source}`, {
    rows: data?.length ?? 0,
  });
  return data ?? [];
}

export interface RecomputeResult {
  ok: boolean;
  habitations?: number;
  duration_ms?: number;
  results?: Record<string, { zones_used: number; rows_written: number }>;
}

/**
 * Trigger the compute-scores Edge Function, which upserts rr_scores.
 *
 * Routed through /api/recompute rather than supabase.functions.invoke for two
 * reasons:
 *
 *   1. The function is guarded by RR_COMPUTE_SECRET, which a browser cannot
 *      hold. The server-side route attaches it.
 *   2. functions.invoke reports any non-2xx as the literal string "Edge
 *      Function returned a non-2xx status code" and buries the real body on
 *      error.context, so the actual cause never reaches the UI. The proxy
 *      relays the body verbatim and this reads it.
 *
 * Omitting `source` recomputes both datasets.
 */
export async function recomputeScores(
  source?: DataSource,
): Promise<RecomputeResult> {
  const response = await fetch("/api/recompute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(source ? { source } : {}),
  });

  const text = await response.text();
  let payload: (RecomputeResult & { error?: string; hint?: string }) | null =
    null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    console.error("[data] recompute failed", {
      status: response.status,
      statusText: response.statusText,
      payload,
      rawBody: payload ? undefined : text.slice(0, 500),
    });

    const detail =
      payload?.error ?? text.slice(0, 300) ?? response.statusText ?? "no body";
    const hint = payload?.hint ? ` — ${payload.hint}` : "";
    throw new Error(`Recompute failed (HTTP ${response.status}): ${detail}${hint}`);
  }

  if (!payload?.ok) {
    console.error("[data] recompute returned ok=false", { payload });
    throw new Error(
      `Recompute did not succeed: ${payload?.error ?? "unexpected response shape"}`,
    );
  }

  console.info("[data] recompute succeeded", payload);
  return payload;
}

/** Hazard zones belonging to one dataset. */
export function zonesForSource(
  zones: HazardZone[],
  source: DataSource,
): HazardZone[] {
  return zones.filter((z) => z.source === source);
}

/** Every historical zone, regardless of the active dataset. */
export function historicalZones(zones: HazardZone[]): HazardZone[] {
  return zones.filter((z) => z.source === "historical");
}

/**
 * Human label for a historical dataset, taken from the data rather than
 * hardcoded, e.g. "Wayanad Landslide 2024".
 */
export function eventLabelFor(zones: HazardZone[]): string | null {
  for (const zone of zones) {
    if (zone.event_label) return zone.event_label;
  }
  return null;
}

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

export async function fetchBaseData(): Promise<BaseData> {
  const [zones, sites, habitations] = await Promise.all([
    supabase
      .from("rr_hazard_zones")
      .select(
        "id, geom, hazard_type, intensity, source, event_label, metadata, created_at",
      )
      .order("intensity", { ascending: false }),
    supabase
      .from("rr_safe_sites")
      .select("id, geom, name, capacity_max, infra_score, created_at")
      .order("capacity_max", { ascending: false }),
    supabase
      .from("rr_habitations")
      .select("id, geom, name, population, created_at")
      .order("name"),
  ]);

  const failure = zones.error ?? sites.error ?? habitations.error;
  if (failure) throw new Error(`Supabase read failed: ${failure.message}`);

  return {
    hazardZones: zones.data ?? [],
    safeSites: sites.data ?? [],
    habitations: habitations.data ?? [],
  };
}

/** Persisted scores for one hazard dataset, ordered by rank. */
export async function fetchScores(source: DataSource): Promise<Score[]> {
  const { data, error } = await supabase
    .from("rr_scores")
    .select(
      "id, habitation_id, hazard_score, capacity_score, priority_rank, factor_breakdown, nearest_safe_site_id, source, computed_at",
    )
    .eq("source", source)
    .order("priority_rank", { ascending: true });

  if (error) throw new Error(`Reading rr_scores failed: ${error.message}`);
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
 * The dashboard's key is read-only, so this is the only path that can write
 * scores — the function runs with the service-role key server-side. Omitting
 * `source` recomputes both datasets in one call.
 */
export async function recomputeScores(
  source?: DataSource,
): Promise<RecomputeResult> {
  const { data, error } = await supabase.functions.invoke<RecomputeResult>(
    "compute-scores",
    { body: source ? { source } : {} },
  );

  if (error) throw new Error(`Recompute failed: ${error.message}`);
  if (!data?.ok) throw new Error("Recompute returned an unsuccessful response.");
  return data;
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

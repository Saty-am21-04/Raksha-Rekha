/**
 * Reads for the rr_* tables.
 *
 * Everything is fetched once: the whole dataset is 15 hazard zones, 10 safe
 * sites and 41 habitations, so the Backtest Mode toggle can re-derive from
 * memory instead of making a round trip per switch.
 */

import { supabase } from "@/lib/supabase/client";
import type {
  DataSource,
  Habitation,
  HazardZone,
  SafeSite,
  Score,
} from "@/lib/supabase/types";

export interface DashboardData {
  hazardZones: HazardZone[];
  safeSites: SafeSite[];
  habitations: Habitation[];
  /** Rows from rr_scores; empty until the scoring migration is applied. */
  persistedScores: Score[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [zones, sites, habitations, scores] = await Promise.all([
    supabase
      .from("rr_hazard_zones")
      .select("id, geom, hazard_type, intensity, source, event_label, created_at")
      .order("intensity", { ascending: false }),
    supabase
      .from("rr_safe_sites")
      .select("id, geom, name, capacity_max, infra_score, created_at")
      .order("capacity_max", { ascending: false }),
    supabase
      .from("rr_habitations")
      .select("id, geom, name, population, created_at")
      .order("name"),
    supabase
      .from("rr_scores")
      .select(
        "id, habitation_id, hazard_score, capacity_score, priority_rank, factor_breakdown, nearest_safe_site_id, computed_at",
      ),
  ]);

  const failure =
    zones.error ?? sites.error ?? habitations.error ?? scores.error;
  if (failure) {
    throw new Error(`Supabase read failed: ${failure.message}`);
  }

  return {
    hazardZones: zones.data ?? [],
    safeSites: sites.data ?? [],
    habitations: habitations.data ?? [],
    persistedScores: scores.data ?? [],
  };
}

/** Hazard zones belonging to one dataset. */
export function zonesForSource(
  zones: HazardZone[],
  source: DataSource,
): HazardZone[] {
  return zones.filter((z) => z.source === source);
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

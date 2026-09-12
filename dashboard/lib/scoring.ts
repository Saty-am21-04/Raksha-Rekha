/**
 * Adapter between the canonical scoring model and the dashboard's view types.
 *
 * The model itself lives in lib/scoring-core.ts and is shared verbatim with the
 * compute-scores Edge Function. Nothing here re-implements a formula; this file
 * only:
 *
 *   • turns persisted rr_scores rows into the shape the panel/list/map expect
 *   • runs the same model client-side for the what-if slider
 *   • resolves the ids the core returns back into HazardZone / SafeSite objects
 *   • scales the stored 0..1 scores to the 0..100 the UI renders
 *
 * Storage keeps hazard_score/capacity_score normalised 0..1, which is the
 * contract the Edge Function writes. factor_breakdown stays 0..1 either way,
 * since the panel draws those as fractions.
 */

import {
  HAZARD_INFLUENCE_KM,
  distanceToPolygonKm,
  haversineKm,
  scoreAll,
  type CoreFactorBreakdown,
} from "@/lib/scoring-core";
import type {
  DataSource,
  FactorBreakdown,
  Habitation,
  HazardZone,
  SafeSite,
  Score,
} from "@/lib/supabase/types";

/** Stored scores are 0..1; the UI's tiles and bars read 0..100. */
const TO_PERCENT = 100;

export const FACTOR_LABELS: Record<keyof FactorBreakdown, string> = {
  hazard_intensity: "Hazard intensity",
  hazard_type: "Hazard type severity",
  history: "Historical recurrence",
};

/** Render order, heaviest weight first (0.40 / 0.35 / 0.25). */
export const FACTOR_ORDER: (keyof FactorBreakdown)[] = [
  "hazard_intensity",
  "hazard_type",
  "history",
];

export interface ScoreDetail {
  /** Zones whose polygon contains the habitation. */
  containingZones: HazardZone[];
  /** Zones within the influence radius but not containing it. */
  nearbyZones: HazardZone[];
  nearestSafeSite: SafeSite | null;
  nearestSafeSiteKm: number | null;
  /** Recorded historical failures within influence range — the recurrence signal. */
  nearbyHistoricalCount: number;
  /** Ranking value, 0..100. */
  urgency: number;
}

export type ScoredHabitation = Habitation & {
  score: Score;
  detail: ScoreDetail;
};

/**
 * Which zones act on a habitation, and its nearest site.
 *
 * rr_scores stores the numbers but not the supporting context, so this is
 * recomputed locally for the panel in both persisted and simulated modes. It is
 * cheap — 42 habitations against 14 polygons.
 */
function resolveDetail(
  habitation: Habitation,
  activeZones: HazardZone[],
  historicalZones: HazardZone[],
  sites: SafeSite[],
): Omit<ScoreDetail, "urgency"> {
  const at = habitation.geom.coordinates;

  const containingZones: HazardZone[] = [];
  const nearbyZones: HazardZone[] = [];

  for (const zone of activeZones) {
    const km = distanceToPolygonKm(at, zone.geom);
    if (km > HAZARD_INFLUENCE_KM) continue;
    if (km === 0) containingZones.push(zone);
    else nearbyZones.push(zone);
  }

  let nearbyHistoricalCount = 0;
  for (const zone of historicalZones) {
    if (distanceToPolygonKm(at, zone.geom) <= HAZARD_INFLUENCE_KM) {
      nearbyHistoricalCount++;
    }
  }

  let nearestSafeSite: SafeSite | null = null;
  let nearestSafeSiteKm: number | null = null;
  for (const site of sites) {
    const d = haversineKm(at, site.geom.coordinates);
    if (nearestSafeSiteKm === null || d < nearestSafeSiteKm) {
      nearestSafeSiteKm = d;
      nearestSafeSite = site;
    }
  }

  return {
    containingZones,
    nearbyZones,
    nearestSafeSite,
    nearestSafeSiteKm,
    nearbyHistoricalCount,
  };
}

function emptyBreakdown(): FactorBreakdown {
  return { hazard_intensity: 0, hazard_type: 0, history: 0 };
}

/**
 * Build the view model from persisted rr_scores rows.
 *
 * Habitations without a stored row still render, with zeroed scores and no rank,
 * so a partially-computed table degrades visibly instead of dropping rows.
 */
export function fromPersistedScores(
  habitations: Habitation[],
  activeZones: HazardZone[],
  historicalZones: HazardZone[],
  sites: SafeSite[],
  persisted: Score[],
): ScoredHabitation[] {
  const byHabitation = new Map(persisted.map((s) => [s.habitation_id, s]));

  const rows = habitations.map((habitation) => {
    const stored = byHabitation.get(habitation.id);
    const detail = resolveDetail(habitation, activeZones, historicalZones, sites);

    const hazard = stored ? Number(stored.hazard_score) : 0;
    const capacity = stored ? Number(stored.capacity_score) : 0;

    return {
      ...habitation,
      score: {
        id: stored?.id ?? `missing:${habitation.id}`,
        habitation_id: habitation.id,
        hazard_score: hazard * TO_PERCENT,
        capacity_score: capacity * TO_PERCENT,
        priority_rank: stored?.priority_rank ?? null,
        factor_breakdown:
          (stored?.factor_breakdown as FactorBreakdown | null) ??
          emptyBreakdown(),
        nearest_safe_site_id:
          stored?.nearest_safe_site_id ?? detail.nearestSafeSite?.id ?? null,
        source: stored?.source ?? null,
        computed_at: stored?.computed_at ?? null,
      },
      detail: {
        ...detail,
        // Mirrors the core's ranking blend, for display only.
        urgency:
          (0.65 * hazard + 0.35 * (1 - capacity)) * TO_PERCENT,
      },
    };
  });

  return sortByRank(rows);
}

/**
 * Run the shared model client-side for the what-if slider.
 *
 * `intensityMultiplier` of 1 reproduces the persisted baseline. Nothing here
 * writes to Supabase — this exists purely so the slider is instant.
 */
export function simulateScores(
  habitations: Habitation[],
  activeZones: HazardZone[],
  historicalZones: HazardZone[],
  sites: SafeSite[],
  intensityMultiplier: number,
  source: DataSource,
): ScoredHabitation[] {
  const scored = scoreAll(
    habitations,
    activeZones,
    historicalZones,
    sites,
    intensityMultiplier,
  );

  const habitationById = new Map(habitations.map((h) => [h.id, h]));

  const rows = scored.flatMap(({ score, detail }) => {
    const habitation = habitationById.get(score.habitation_id);
    if (!habitation) return [];

    const resolved = resolveDetail(
      habitation,
      activeZones,
      historicalZones,
      sites,
    );

    return [
      {
        ...habitation,
        score: {
          id: `simulated:${habitation.id}`,
          habitation_id: habitation.id,
          hazard_score: score.hazard_score * TO_PERCENT,
          capacity_score: score.capacity_score * TO_PERCENT,
          priority_rank: score.priority_rank,
          factor_breakdown: score.factor_breakdown as CoreFactorBreakdown,
          nearest_safe_site_id: score.nearest_safe_site_id,
          source,
          computed_at: null,
        },
        detail: {
          ...resolved,
          nearestSafeSiteKm: detail.nearestSafeSiteKm,
          urgency: detail.urgency * TO_PERCENT,
        },
      },
    ];
  });

  return sortByRank(rows);
}

function sortByRank(rows: ScoredHabitation[]): ScoredHabitation[] {
  return [...rows].sort((a, b) => {
    const ar = a.score.priority_rank ?? Number.MAX_SAFE_INTEGER;
    const br = b.score.priority_rank ?? Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Priority scoring for habitations.
 *
 * `rr_scores` is empty in the remote project and the dashboard holds a
 * read-only publishable key, so scores are derived here from the three tables
 * the anon role can read. Output deliberately matches the `rr_scores` row shape
 * so the panel and list can switch to server-side scores without UI changes:
 * populate rr_scores with an equivalent PostGIS pass (ST_Intersects for
 * exposure, ST_Distance for the safe-site terms) and mergePersistedScores()
 * will prefer those rows automatically. No such migration exists yet.
 *
 * Deriving scores in the app also makes Backtest Mode meaningful: swapping the
 * hazard source recomputes every score against that dataset, rather than
 * re-colouring the same static ranks.
 */

import { distanceToPolygonKm, haversineKm, toLngLat } from "@/lib/geo";
import type {
  FactorBreakdown,
  Habitation,
  HazardZone,
  SafeSite,
  Score,
} from "@/lib/supabase/types";

/** How far outside a zone boundary hazard influence still registers. */
const HAZARD_INFLUENCE_KM = 2;

/** Weights inside hazard_score. */
const HAZARD_WEIGHTS = { exposure: 0.55, severity: 0.45 } as const;

/** Weights inside capacity_score (as a shortfall, then inverted). */
const CAPACITY_WEIGHTS = { distance: 0.5, capacity: 0.5 } as const;

/** Weights that combine into the ranking urgency. */
const URGENCY_WEIGHTS = {
  hazard: 0.5,
  population: 0.2,
  capacityShortfall: 0.3,
} as const;

export const FACTOR_LABELS: Record<keyof FactorBreakdown, string> = {
  hazard_exposure: "Hazard exposure",
  hazard_severity: "Hazard severity",
  population_pressure: "Population pressure",
  safe_site_distance: "Distance to safe site",
  safe_site_capacity: "Capacity shortfall",
};

/** Order the factors render in, worst-contributing concept first. */
export const FACTOR_ORDER: (keyof FactorBreakdown)[] = [
  "hazard_exposure",
  "hazard_severity",
  "population_pressure",
  "safe_site_distance",
  "safe_site_capacity",
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round = (n: number, dp = 1) => Number(n.toFixed(dp));

/** Extra detail the UI shows alongside the raw rr_scores columns. */
export interface ScoreDetail {
  /** Zones whose polygon contains the habitation. */
  containingZones: HazardZone[];
  /** Zones within HAZARD_INFLUENCE_KM but not containing it. */
  nearbyZones: HazardZone[];
  nearestSafeSite: SafeSite | null;
  nearestSafeSiteKm: number | null;
  /** Ranking value the sort is built on, 0–100. */
  urgency: number;
}

export type ScoredHabitation = Habitation & {
  score: Score;
  detail: ScoreDetail;
};

interface Intermediate {
  habitation: Habitation;
  factors: FactorBreakdown;
  hazardScore: number;
  capacityScore: number;
  urgency: number;
  detail: Omit<ScoreDetail, "urgency">;
}

/**
 * Score every habitation against a hazard set and the available safe sites.
 * Returns habitations ordered by priority_rank (1 = most urgent).
 */
export function scoreHabitations(
  habitations: Habitation[],
  hazardZones: HazardZone[],
  safeSites: SafeSite[],
): ScoredHabitation[] {
  if (habitations.length === 0) return [];

  const maxPopulation = Math.max(...habitations.map((h) => h.population), 1);

  // Longest nearest-site distance in this dataset, used to normalise the
  // distance factor so the ramp always spans the visible spread.
  const nearestDistances = habitations.map((h) => {
    const origin = toLngLat(h.geom);
    let best = Number.POSITIVE_INFINITY;
    for (const site of safeSites) {
      const d = haversineKm(origin, toLngLat(site.geom));
      if (d < best) best = d;
    }
    return Number.isFinite(best) ? best : 0;
  });
  const maxNearestKm = Math.max(...nearestDistances, 1);

  const intermediate: Intermediate[] = habitations.map((habitation, i) => {
    const origin = toLngLat(habitation.geom);

    const containingZones: HazardZone[] = [];
    const nearbyZones: HazardZone[] = [];
    // Severity is the strongest hazard felt here, with distance falloff.
    let severity = 0;
    let proximityExposure = 0;

    for (const zone of hazardZones) {
      const km = distanceToPolygonKm(origin, zone.geom);
      if (km === 0) {
        containingZones.push(zone);
        severity = Math.max(severity, zone.intensity / 10);
        continue;
      }
      if (km <= HAZARD_INFLUENCE_KM) {
        nearbyZones.push(zone);
        const falloff = 1 - km / HAZARD_INFLUENCE_KM;
        severity = Math.max(severity, (zone.intensity / 10) * falloff);
        proximityExposure = Math.max(proximityExposure, falloff * 0.6);
      }
    }

    // Sitting inside a zone dominates; overlapping zones add a little on top.
    const exposure =
      containingZones.length > 0
        ? clamp01(0.7 + 0.15 * (containingZones.length - 1) + 0.15)
        : proximityExposure;

    // Log scale keeps a 2000-person town from flattening 20-person hamlets.
    const populationPressure = clamp01(
      Math.log1p(habitation.population) / Math.log1p(maxPopulation),
    );

    let nearestSafeSite: SafeSite | null = null;
    let nearestSafeSiteKm: number | null = null;
    for (const site of safeSites) {
      const d = haversineKm(origin, toLngLat(site.geom));
      if (nearestSafeSiteKm === null || d < nearestSafeSiteKm) {
        nearestSafeSiteKm = d;
        nearestSafeSite = site;
      }
    }

    const distanceFactor = clamp01((nearestDistances[i] ?? 0) / maxNearestKm);

    // Shortfall of the nearest site against this population, softened by that
    // site's infrastructure readiness.
    const capacity = nearestSafeSite?.capacity_max ?? 0;
    const infra = nearestSafeSite?.infra_score ?? 0.5;
    const rawShortfall = clamp01(1 - capacity / Math.max(habitation.population, 1));
    const capacityShortfall = clamp01(rawShortfall * (1 - 0.3 * infra));

    const factors: FactorBreakdown = {
      hazard_exposure: round(exposure, 3),
      hazard_severity: round(severity, 3),
      population_pressure: round(populationPressure, 3),
      safe_site_distance: round(distanceFactor, 3),
      safe_site_capacity: round(capacityShortfall, 3),
    };

    const hazardScore =
      100 *
      (HAZARD_WEIGHTS.exposure * exposure + HAZARD_WEIGHTS.severity * severity);

    // capacity_score reads "how well served" — high is good.
    const capacityShortfallBlend =
      CAPACITY_WEIGHTS.distance * distanceFactor +
      CAPACITY_WEIGHTS.capacity * capacityShortfall;
    const capacityScore = 100 * (1 - capacityShortfallBlend);

    const urgency =
      URGENCY_WEIGHTS.hazard * hazardScore +
      URGENCY_WEIGHTS.population * (populationPressure * 100) +
      URGENCY_WEIGHTS.capacityShortfall * (capacityShortfallBlend * 100);

    return {
      habitation,
      factors,
      hazardScore,
      capacityScore,
      urgency,
      detail: {
        containingZones,
        nearbyZones,
        nearestSafeSite,
        nearestSafeSiteKm,
      },
    };
  });

  // Rank by urgency; population then name break ties so ordering is stable.
  const ranked = [...intermediate].sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    if (b.habitation.population !== a.habitation.population) {
      return b.habitation.population - a.habitation.population;
    }
    return a.habitation.name.localeCompare(b.habitation.name);
  });

  return ranked.map((entry, index) => ({
    ...entry.habitation,
    score: {
      // Synthetic id — these rows are computed, not persisted.
      id: `computed:${entry.habitation.id}`,
      habitation_id: entry.habitation.id,
      hazard_score: round(entry.hazardScore),
      capacity_score: round(entry.capacityScore),
      priority_rank: index + 1,
      factor_breakdown: entry.factors,
      nearest_safe_site_id: entry.detail.nearestSafeSite?.id ?? null,
      computed_at: null,
    },
    detail: { ...entry.detail, urgency: round(entry.urgency) },
  }));
}

/**
 * Merge persisted `rr_scores` rows over computed ones.
 *
 * The moment someone runs the scoring migration, real rows take precedence and
 * ranks are rebuilt from them; until then every habitation keeps its computed
 * score. Falls back wholesale when the table is empty.
 */
export function mergePersistedScores(
  computed: ScoredHabitation[],
  persisted: Score[],
): { rows: ScoredHabitation[]; usedPersisted: boolean } {
  if (persisted.length === 0) return { rows: computed, usedPersisted: false };

  const byHabitation = new Map(persisted.map((s) => [s.habitation_id, s]));

  const merged = computed.map((row) => {
    const hit = byHabitation.get(row.id);
    return hit ? { ...row, score: hit } : row;
  });

  const ordered = [...merged].sort((a, b) => {
    const ar = a.score.priority_rank ?? Number.MAX_SAFE_INTEGER;
    const br = b.score.priority_rank ?? Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name);
  });

  return { rows: ordered, usedPersisted: true };
}

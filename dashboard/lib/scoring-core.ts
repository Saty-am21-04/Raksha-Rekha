/**
 * Canonical scoring model for RAKSHA-REKHA.
 *
 * ── DO NOT ADD IMPORTS TO THIS FILE ──
 * This module is deliberately dependency-free and alias-free so the same source
 * runs in two toolchains: Next.js (the what-if slider) and Deno (the
 * compute-scores Edge Function). `supabase/functions/_shared/scoring-core.ts` is
 * a generated copy — edit this file, then run `npm run sync:scoring`.
 * `npm run verify:scoring` fails the build if the two drift apart, so the
 * persisted baseline and the live simulation can never disagree silently.
 *
 * Score conventions, which the storage layer and the UI read differently:
 *   hazard_score, capacity_score  0..1  (as stored in rr_scores)
 *   factor_breakdown values       0..1  (contributions, summing to hazard_score)
 *   priority_rank                 1..n  (1 = most urgent)
 *
 * The dashboard scales the two scores to 0..100 for display; factor_breakdown
 * stays 0..1 because the panel's bars are fractions.
 */

/* ============================================================
   Shapes — structural, so both callers can pass their own types
   ============================================================ */

export interface CorePoint {
  /** [lng, lat] */
  coordinates: [number, number];
}

export interface CorePolygon {
  /** Array of rings, each a list of [lng, lat]. Ring 0 is the exterior. */
  coordinates: [number, number][][];
}

export interface CoreZone {
  id: string;
  geom: CorePolygon;
  hazard_type: string;
  /** 1..10 */
  intensity: number;
  source: string;
}

export interface CoreSite {
  id: string;
  geom: CorePoint;
  capacity_max: number;
  infra_score: number | null;
}

export interface CoreHabitation {
  id: string;
  geom: CorePoint;
  name: string;
  population: number;
}

export interface CoreFactorBreakdown {
  /** 0.4 weight — intensity of the strongest zone acting here. */
  hazard_intensity: number;
  /** 0.35 weight — severity of that hazard's type. */
  hazard_type: number;
  /** 0.25 weight — recurrence: historical failures on this terrain. */
  history: number;
}

export interface CoreScore {
  habitation_id: string;
  /** 0..1 */
  hazard_score: number;
  /** 0..1, higher means more relocation headroom nearby. */
  capacity_score: number;
  priority_rank: number;
  factor_breakdown: CoreFactorBreakdown;
  nearest_safe_site_id: string | null;
}

/** Extra context the dashboard shows; not persisted to rr_scores. */
export interface CoreScoreDetail {
  containingZoneIds: string[];
  nearbyZoneIds: string[];
  nearestSafeSiteKm: number | null;
  nearbyHistoricalCount: number;
  urgency: number;
}

/* ============================================================
   Model constants
   ============================================================ */

/** Weights of the three hazard factors. Must sum to 1. */
export const HAZARD_WEIGHTS = {
  hazard_intensity: 0.4,
  hazard_type: 0.35,
  history: 0.25,
} as const;

/**
 * Relative severity by hazard type. A landslide of intensity 8 is a graver
 * threat to a hill settlement than coastal erosion of the same rating, so type
 * carries its own weight rather than being folded into intensity.
 */
export const HAZARD_TYPE_SEVERITY: Record<string, number> = {
  landslide: 1.0,
  cloudburst: 0.85,
  flood: 0.7,
  coastal_erosion: 0.5,
};

/** Fallback for a hazard_type not in the table above. */
const DEFAULT_TYPE_SEVERITY = 0.6;

/** How far beyond a zone boundary hazard influence still registers, in km. */
export const HAZARD_INFLUENCE_KM = 2;

/** Nearby historical zones needed to saturate the recurrence factor. */
export const HISTORY_SATURATION_COUNT = 3;

/** Split between hazard and capacity when ranking. */
export const URGENCY_WEIGHTS = { hazard: 0.65, capacityShortfall: 0.35 } as const;

/** Infra score assumed when a site leaves it null. */
const DEFAULT_INFRA_SCORE = 0.5;

const EARTH_RADIUS_KM = 6371;
const DEG_TO_KM = (Math.PI / 180) * EARTH_RADIUS_KM;

/* ============================================================
   Geometry — plane approximation, valid at this extent
   ============================================================ */

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const round = (n: number, dp: number) => Number(n.toFixed(dp));

/** Great-circle distance in km between [lng, lat] pairs. */
export function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Ray-casting containment against the exterior ring. */
export function pointInPolygon(
  point: [number, number],
  polygon: CorePolygon,
): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    if (yi > point[1] === yj > point[1]) continue;

    const xCrossing = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (point[0] < xCrossing) inside = !inside;
  }
  return inside;
}

/** Distance in km from a point to a polygon boundary; 0 when inside. */
export function distanceToPolygonKm(
  point: [number, number],
  polygon: CorePolygon,
): number {
  if (pointInPolygon(point, polygon)) return 0;

  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 2) return Number.POSITIVE_INFINITY;

  // Longitude compresses toward the poles; scale it so the plane is metric.
  const lngScale = Math.cos((point[1] * Math.PI) / 180);
  const px = point[0] * lngScale;
  const py = point[1];

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = ring[i][0] * lngScale;
    const ay = ring[i][1];
    const bx = ring[i + 1][0] * lngScale;
    const by = ring[i + 1][1];

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    const t =
      lenSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq),
          );

    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * DEG_TO_KM;
    if (d < min) min = d;
  }
  return min;
}

/* ============================================================
   Hazard side
   ============================================================ */

export interface HazardResult {
  hazard_score: number;
  factor_breakdown: CoreFactorBreakdown;
  containingZoneIds: string[];
  nearbyZoneIds: string[];
  nearbyHistoricalCount: number;
}

/**
 * Hazard exposure for one habitation.
 *
 * `activeZones` is the dataset in play (synthetic or historical).
 * `historicalZones` is always the full set of historical zones regardless of
 * mode, because the recurrence factor is about what this terrain has already
 * done — Puthumala 2019 should raise Mundakkai's risk even while viewing the
 * synthetic set.
 *
 * `intensityMultiplier` (1 = baseline) drives the what-if slider. It scales
 * intensity only; type severity and recurrence history are properties of the
 * terrain and do not move with a rainfall what-if.
 */
export function computeHazard(
  habitation: CoreHabitation,
  activeZones: CoreZone[],
  historicalZones: CoreZone[],
  intensityMultiplier = 1,
): HazardResult {
  const at = habitation.geom.coordinates;

  const containingZoneIds: string[] = [];
  const nearbyZoneIds: string[] = [];

  let intensityFactor = 0;
  let typeFactor = 0;

  for (const zone of activeZones) {
    const km = distanceToPolygonKm(at, zone.geom);
    if (km > HAZARD_INFLUENCE_KM) continue;

    if (km === 0) containingZoneIds.push(zone.id);
    else nearbyZoneIds.push(zone.id);

    // Full weight inside the polygon, tapering to zero at the influence edge.
    const falloff = km === 0 ? 1 : 1 - km / HAZARD_INFLUENCE_KM;

    const scaled = (zone.intensity * intensityMultiplier) / 10;
    intensityFactor = Math.max(intensityFactor, clamp01(scaled) * falloff);

    const severity =
      HAZARD_TYPE_SEVERITY[zone.hazard_type] ?? DEFAULT_TYPE_SEVERITY;
    typeFactor = Math.max(typeFactor, severity * falloff);
  }

  // Recurrence: how many recorded failures sit within influence range.
  let nearbyHistoricalCount = 0;
  for (const zone of historicalZones) {
    if (distanceToPolygonKm(at, zone.geom) <= HAZARD_INFLUENCE_KM) {
      nearbyHistoricalCount++;
    }
  }
  const historyFactor = clamp01(
    nearbyHistoricalCount / HISTORY_SATURATION_COUNT,
  );

  const factor_breakdown: CoreFactorBreakdown = {
    hazard_intensity: round(HAZARD_WEIGHTS.hazard_intensity * intensityFactor, 4),
    hazard_type: round(HAZARD_WEIGHTS.hazard_type * typeFactor, 4),
    history: round(HAZARD_WEIGHTS.history * historyFactor, 4),
  };

  const hazard_score = round(
    factor_breakdown.hazard_intensity +
      factor_breakdown.hazard_type +
      factor_breakdown.history,
    4,
  );

  return {
    hazard_score,
    factor_breakdown,
    containingZoneIds,
    nearbyZoneIds,
    nearbyHistoricalCount,
  };
}

/* ============================================================
   Capacity side
   ============================================================ */

export interface NearestSite {
  siteId: string | null;
  km: number | null;
}

/** Nearest relocation site to a habitation, by straight-line distance. */
export function nearestSite(
  habitation: CoreHabitation,
  sites: CoreSite[],
): NearestSite {
  let siteId: string | null = null;
  let km: number | null = null;

  for (const site of sites) {
    const d = haversineKm(habitation.geom.coordinates, site.geom.coordinates);
    if (km === null || d < km) {
      km = d;
      siteId = site.id;
    }
  }
  return { siteId, km };
}

/** Effective capacity of a site: raw beds discounted by infrastructure readiness. */
export function effectiveCapacity(site: CoreSite): number {
  const infra = site.infra_score ?? DEFAULT_INFRA_SCORE;
  return site.capacity_max * infra;
}

/* ============================================================
   Full pass
   ============================================================ */

export interface ScoredRow {
  score: CoreScore;
  detail: CoreScoreDetail;
}

/**
 * Score every habitation against one hazard dataset.
 *
 * Capacity needs two passes: assign each habitation to its nearest site, total
 * the population leaning on each site, then measure the headroom left. A site
 * already oversubscribed by closer settlements offers no refuge, which a
 * single-pass distance check would miss.
 */
export function scoreAll(
  habitations: CoreHabitation[],
  activeZones: CoreZone[],
  historicalZones: CoreZone[],
  sites: CoreSite[],
  intensityMultiplier = 1,
): ScoredRow[] {
  if (habitations.length === 0) return [];

  // Pass 1 — nearest site and hazard exposure.
  const assignments = new Map<string, NearestSite>();
  const allocatedLoad = new Map<string, number>();
  const hazards = new Map<string, HazardResult>();

  for (const h of habitations) {
    const nearest = nearestSite(h, sites);
    assignments.set(h.id, nearest);

    if (nearest.siteId) {
      allocatedLoad.set(
        nearest.siteId,
        (allocatedLoad.get(nearest.siteId) ?? 0) + h.population,
      );
    }

    hazards.set(
      h.id,
      computeHazard(h, activeZones, historicalZones, intensityMultiplier),
    );
  }

  const siteById = new Map(sites.map((s) => [s.id, s]));

  // Pass 2 — capacity headroom and urgency.
  const rows = habitations.map((h) => {
    const hazard = hazards.get(h.id)!;
    const nearest = assignments.get(h.id)!;
    const site = nearest.siteId ? siteById.get(nearest.siteId) : undefined;

    let capacity_score = 0;
    if (site) {
      const capacity = effectiveCapacity(site);
      const load = allocatedLoad.get(site.id) ?? 0;

      /**
       * Coverage ratio: the share of the population leaning on this site that
       * the site can actually absorb.
       *
       * Expressing this as leftover headroom over capacity — (capacity - load)
       * / capacity — collapses on real data. Across the Wayanad seed the 42
       * habitations total 22,853 people against 2,547 effective capacity, so
       * demand outruns supply roughly 9:1 and almost every site is
       * oversubscribed. Headroom then floors at 0 for all but one habitation,
       * leaving capacity_score with two distinct values and no ability to
       * discriminate, which in turn made priority_rank a pure function of
       * hazard.
       *
       * A ratio keeps the same reading — higher means better served, 0 means no
       * usable refuge — while degrading smoothly, so a site that can take 40%
       * of its dependents scores 0.4 instead of 0.
       */
      capacity_score =
        load <= 0 ? 1 : capacity <= 0 ? 0 : clamp01(capacity / load);
    }

    const urgency =
      URGENCY_WEIGHTS.hazard * hazard.hazard_score +
      URGENCY_WEIGHTS.capacityShortfall * (1 - capacity_score);

    return {
      habitation: h,
      hazard,
      nearest,
      capacity_score: round(capacity_score, 4),
      urgency: round(urgency, 4),
    };
  });

  // Rank: more hazard and less capacity means higher priority. Population then
  // name break ties so the ordering is stable across runs.
  const ranked = [...rows].sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    if (b.habitation.population !== a.habitation.population) {
      return b.habitation.population - a.habitation.population;
    }
    return a.habitation.name.localeCompare(b.habitation.name);
  });

  return ranked.map((r, i) => ({
    score: {
      habitation_id: r.habitation.id,
      hazard_score: r.hazard.hazard_score,
      capacity_score: r.capacity_score,
      priority_rank: i + 1,
      factor_breakdown: r.hazard.factor_breakdown,
      nearest_safe_site_id: r.nearest.siteId,
    },
    detail: {
      containingZoneIds: r.hazard.containingZoneIds,
      nearbyZoneIds: r.hazard.nearbyZoneIds,
      nearestSafeSiteKm: r.nearest.km === null ? null : round(r.nearest.km, 3),
      nearbyHistoricalCount: r.hazard.nearbyHistoricalCount,
      urgency: r.urgency,
    },
  }));
}

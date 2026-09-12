/**
 * Adapters from rr_* rows to the FeatureCollections the Mapbox layers bind to.
 *
 * Every value a layer paints with is flattened into feature properties, because
 * Mapbox style expressions can only read scalars — nested objects like
 * factor_breakdown stay in React state and are looked up by id.
 */

import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

import { toLngLat } from "@/lib/geo";
import type { ScoredHabitation } from "@/lib/scoring";
import { safeSiteRadius } from "@/lib/theme";
import type { HazardZone, SafeSite } from "@/lib/supabase/types";

export interface HazardProps {
  id: string;
  hazard_type: string;
  /** Effective intensity after the what-if multiplier, clamped to 1–10. */
  intensity: number;
  /** Intensity as stored, so a simulation can be compared to the baseline. */
  base_intensity: number;
  source: string;
  event_label: string | null;
}

export interface SafeSiteProps {
  id: string;
  name: string;
  capacity_max: number;
  infra_score: number | null;
  radius: number;
}

export interface HabitationProps {
  id: string;
  name: string;
  population: number;
  priority_rank: number | null;
  hazard_score: number;
  capacity_score: number;
  /** 0 = most urgent, 1 = least. Drives the colour ramp. */
  priorityFraction: number;
  selected: boolean;
}

/**
 * `intensityMultiplier` lets the what-if slider drive the map without touching
 * any layer paint: the existing colour and opacity expressions already read
 * `intensity`, so scaling it here is enough to re-render the zones.
 *
 * Clamped to 1–10 to match the CHECK on rr_hazard_zones.intensity and the
 * clamp inside the scoring model, so the map and the scores saturate together.
 */
export function hazardZonesToGeoJSON(
  zones: HazardZone[],
  intensityMultiplier = 1,
): FeatureCollection<Polygon, HazardProps> {
  return {
    type: "FeatureCollection",
    features: zones.map((zone): Feature<Polygon, HazardProps> => {
      const scaled = Math.min(
        10,
        Math.max(1, Math.round(zone.intensity * intensityMultiplier)),
      );

      return {
        type: "Feature",
        id: zone.id,
        // Strip the legacy `crs` member; Mapbox assumes WGS84 anyway.
        geometry: { type: "Polygon", coordinates: zone.geom.coordinates },
        properties: {
          id: zone.id,
          hazard_type: zone.hazard_type,
          intensity: scaled,
          base_intensity: zone.intensity,
          source: zone.source,
          event_label: zone.event_label,
        },
      };
    }),
  };
}

export function safeSitesToGeoJSON(
  sites: SafeSite[],
): FeatureCollection<Point, SafeSiteProps> {
  return {
    type: "FeatureCollection",
    features: sites.map((site): Feature<Point, SafeSiteProps> => {
      const { lng, lat } = toLngLat(site.geom);
      return {
        type: "Feature",
        id: site.id,
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: site.id,
          name: site.name ?? "Unnamed site",
          capacity_max: site.capacity_max,
          infra_score: site.infra_score,
          radius: safeSiteRadius(site.capacity_max),
        },
      };
    }),
  };
}

export function habitationsToGeoJSON(
  ranked: ScoredHabitation[],
  selectedId: string | null,
): FeatureCollection<Point, HabitationProps> {
  const total = ranked.length;

  return {
    type: "FeatureCollection",
    features: ranked.map((row): Feature<Point, HabitationProps> => {
      const { lng, lat } = toLngLat(row.geom);
      const rank = row.score.priority_rank;
      const fraction =
        rank === null || total <= 1 ? 1 : (rank - 1) / (total - 1);

      return {
        type: "Feature",
        id: row.id,
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: row.id,
          name: row.name,
          population: row.population,
          priority_rank: rank,
          hazard_score: row.score.hazard_score,
          capacity_score: row.score.capacity_score,
          priorityFraction: fraction,
          selected: row.id === selectedId,
        },
      };
    }),
  };
}

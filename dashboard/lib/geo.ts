/**
 * Map-side geometry helpers.
 *
 * The scoring geometry (containment, point-to-polygon distance, great-circle
 * distance) deliberately does NOT live here — it is in lib/scoring-core.ts, the
 * single copy shared with the compute-scores Edge Function. Keeping a second
 * implementation in this file would let the map and the scores disagree about
 * what "inside a hazard zone" means.
 */

import type { GeoPoint } from "@/lib/supabase/types";

export interface LngLat {
  lng: number;
  lat: number;
}

export function toLngLat(point: GeoPoint): LngLat {
  const [lng, lat] = point.coordinates;
  return { lng, lat };
}

export type BBox = [number, number, number, number];

/** Bounding box [west, south, east, north] over any set of coordinates. */
export function bboxOf(points: LngLat[]): BBox | null {
  if (points.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const { lng, lat } of points) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

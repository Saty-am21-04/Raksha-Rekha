/**
 * Small geodesic helpers for the Wayanad extent.
 *
 * At ~11.6°N over a ~12 km box, treating lon/lat as a locally flat plane
 * (scaling longitude by cos(lat)) is accurate to well under a metre, which is
 * far tighter than the seed data's precision. That keeps the whole scoring pass
 * dependency-free and synchronous.
 */

import type { GeoPoint, GeoPolygon } from "@/lib/supabase/types";

const EARTH_RADIUS_KM = 6371;
const DEG_TO_KM = (Math.PI / 180) * EARTH_RADIUS_KM;

export interface LngLat {
  lng: number;
  lat: number;
}

export function toLngLat(point: GeoPoint): LngLat {
  const [lng, lat] = point.coordinates;
  return { lng, lat };
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Ray-casting containment test against the polygon's outer ring.
 *
 * The seed polygons are simple quads with no interior rings; if holes are ever
 * added, rings 1..n would need to flip the result.
 */
export function pointInPolygon(point: LngLat, polygon: GeoPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const straddles = yi > point.lat !== yj > point.lat;
    if (!straddles) continue;

    const xCrossing = ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (point.lng < xCrossing) inside = !inside;
  }
  return inside;
}

/** Perpendicular distance in km from a point to a segment, on the local plane. */
function distanceToSegmentKm(
  p: LngLat,
  a: [number, number],
  b: [number, number],
  lngScale: number,
): number {
  const px = p.lng * lngScale;
  const py = p.lat;
  const ax = a[0] * lngScale;
  const ay = a[1];
  const bx = b[0] * lngScale;
  const by = b[1];

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  // Degenerate segment: fall back to endpoint distance.
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));

  const cx = ax + t * dx;
  const cy = ay + t * dy;

  return Math.hypot(px - cx, py - cy) * DEG_TO_KM;
}

/**
 * Distance in km from a point to a polygon's boundary, or 0 when the point is
 * inside it.
 */
export function distanceToPolygonKm(
  point: LngLat,
  polygon: GeoPolygon,
): number {
  if (pointInPolygon(point, polygon)) return 0;

  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 2) return Number.POSITIVE_INFINITY;

  const lngScale = Math.cos((point.lat * Math.PI) / 180);

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length - 1; i++) {
    const d = distanceToSegmentKm(point, ring[i], ring[i + 1], lngScale);
    if (d < min) min = d;
  }
  return min;
}

/** Centroid of a polygon's outer ring, used to anchor hazard labels. */
export function polygonCentroid(polygon: GeoPolygon): LngLat {
  const ring = polygon.coordinates[0] ?? [];
  // Drop the closing vertex so it isn't double-counted.
  const pts = ring.length > 1 ? ring.slice(0, -1) : ring;
  if (pts.length === 0) return { lng: 0, lat: 0 };

  const sum = pts.reduce(
    (acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }),
    { lng: 0, lat: 0 },
  );
  return { lng: sum.lng / pts.length, lat: sum.lat / pts.length };
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

/**
 * Types for the rr_* schema in the "raksha-rekha" Supabase project.
 *
 * Mirrors supabase/migrations/20260913001100_create_tables.sql.
 *
 * Geometry note: this project's PostgREST serialises PostGIS `geometry` columns
 * straight to GeoJSON (with a legacy `crs` member that Mapbox ignores), so no
 * WKB decoding is needed on the client.
 */

export type HazardType =
  | "landslide"
  | "flood"
  | "cloudburst"
  | "coastal_erosion";

/** rr_hazard_zones.source — the only table in the schema carrying this column. */
export type DataSource = "synthetic" | "historical";

interface LegacyCrs {
  type: "name";
  properties: { name: string };
}

export interface GeoPoint {
  type: "Point";
  /** [lng, lat] */
  coordinates: [number, number];
  crs?: LegacyCrs;
}

export interface GeoPolygon {
  type: "Polygon";
  /** Array of linear rings, each a list of [lng, lat] pairs. */
  coordinates: [number, number][][];
  crs?: LegacyCrs;
}

export interface HazardZone {
  id: string;
  geom: GeoPolygon;
  hazard_type: HazardType;
  /** 1–10, CHECK-constrained in the schema. */
  intensity: number;
  source: DataSource;
  event_label: string | null;
  created_at: string | null;
}

export interface SafeSite {
  id: string;
  geom: GeoPoint;
  name: string | null;
  capacity_max: number;
  infra_score: number | null;
  created_at: string | null;
}

export interface Habitation {
  id: string;
  geom: GeoPoint;
  name: string;
  population: number;
  created_at: string | null;
}

/**
 * Weighted contributions behind a habitation's priority, rendered as the bar
 * chart in the explainability panel. Values are 0–1.
 */
export interface FactorBreakdown {
  hazard_exposure: number;
  hazard_severity: number;
  population_pressure: number;
  safe_site_distance: number;
  safe_site_capacity: number;
}

export interface Score {
  id: string;
  habitation_id: string;
  hazard_score: number;
  capacity_score: number;
  priority_rank: number | null;
  factor_breakdown: FactorBreakdown | null;
  nearest_safe_site_id: string | null;
  computed_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      rr_hazard_zones: {
        Row: HazardZone;
        Insert: never;
        Update: never;
      };
      rr_safe_sites: {
        Row: SafeSite;
        Insert: never;
        Update: never;
      };
      rr_habitations: {
        Row: Habitation;
        Insert: never;
        Update: never;
      };
      rr_scores: {
        Row: Score;
        Insert: never;
        Update: never;
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

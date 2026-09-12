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

/**
 * Observed context for historical zones — rainfall totals, alert status, crown
 * geometry. NULL for synthetic zones, which have no measurements behind them.
 */
export interface HazardMetadata {
  event_date?: string;
  rainfall_24h_mm?: number | null;
  rainfall_3day_mm?: number | null;
  rainfall_5day_mm?: number | null;
  orange_alert_issued?: boolean;
  crown_lon?: number;
  crown_lat?: number;
  crown_area_sqm?: number;
  runout_km?: number;
  affected_villages?: string[];
  panchayat?: string;
  district?: string;
  recurrence_note?: string;
}

export interface HazardZone {
  id: string;
  geom: GeoPolygon;
  hazard_type: HazardType;
  /** 1–10, CHECK-constrained in the schema. */
  intensity: number;
  source: DataSource;
  event_label: string | null;
  metadata: HazardMetadata | null;
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
 * Weighted contributions behind a habitation's hazard score, rendered as the
 * bar chart in the explainability panel.
 *
 * Values are 0–1 and sum to hazard_score. Weights are 0.40 / 0.35 / 0.25 —
 * see lib/scoring-core.ts, which is the single definition shared with the
 * compute-scores Edge Function.
 */
export interface FactorBreakdown {
  hazard_intensity: number;
  hazard_type: number;
  history: number;
}

export interface Score {
  id: string;
  habitation_id: string;
  /** 0–1 as stored; the dashboard scales to 0–100 for display. */
  hazard_score: number;
  /** 0–1 as stored; higher means more relocation headroom nearby. */
  capacity_score: number;
  priority_rank: number | null;
  factor_breakdown: FactorBreakdown | null;
  nearest_safe_site_id: string | null;
  /** Which hazard dataset this row was computed against. */
  source: DataSource | null;
  computed_at: string | null;
}

/**
 * Insert/Update are declared for shape completeness only. This app never
 * mutates: the publishable key carries the `anon` role, which the rr_* RLS
 * policies restrict to SELECT, so any write is rejected at the database.
 */
export interface Database {
  public: {
    Tables: {
      rr_hazard_zones: {
        Row: HazardZone;
        Insert: Omit<HazardZone, "id" | "created_at">;
        Update: Partial<HazardZone>;
      };
      rr_safe_sites: {
        Row: SafeSite;
        Insert: Omit<SafeSite, "id" | "created_at">;
        Update: Partial<SafeSite>;
      };
      rr_habitations: {
        Row: Habitation;
        Insert: Omit<Habitation, "id" | "created_at">;
        Update: Partial<Habitation>;
      };
      rr_scores: {
        Row: Score;
        Insert: Omit<Score, "id" | "computed_at">;
        Update: Partial<Score>;
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

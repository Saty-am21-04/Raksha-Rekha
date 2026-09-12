-- ============================================================
-- raksha-rekha: Full Schema Reference (read-only, generated)
-- SIH 2026 — Disaster-Relocation Planning Prototype
--
-- Run the individual migrations in supabase/migrations/ instead.
-- This file exists for documentation / quick review only.
-- ============================================================

-- ===================== EXTENSIONS =====================

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;


-- ===================== TABLES =====================

CREATE TABLE rr_hazard_zones (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    geom         geometry(Polygon, 4326) NOT NULL,
    hazard_type  text NOT NULL,
    intensity    int  NOT NULL CHECK (intensity BETWEEN 1 AND 10),
    source       text NOT NULL CHECK (source IN ('synthetic', 'historical')),
    event_label  text,
    -- Observed context for historical events: rainfall_24h_mm, rainfall_3day_mm,
    -- rainfall_5day_mm, orange_alert_issued, event_date, crown_lon/crown_lat,
    -- crown_area_sqm, runout_km. NULL for synthetic zones, which have no
    -- measurements behind them.
    metadata     jsonb,
    created_at   timestamptz DEFAULT now()
);

CREATE TABLE rr_safe_sites (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    geom          geometry(Point, 4326) NOT NULL,
    name          text,
    capacity_max  int     NOT NULL,
    infra_score   numeric,
    created_at    timestamptz DEFAULT now()
);

CREATE TABLE rr_habitations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    geom        geometry(Point, 4326) NOT NULL,
    name        text NOT NULL,
    population  int  NOT NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE rr_scores (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    habitation_id         uuid REFERENCES rr_habitations(id) ON DELETE CASCADE,
    hazard_score          numeric NOT NULL,
    capacity_score        numeric NOT NULL,
    priority_rank         int,
    factor_breakdown      jsonb,
    nearest_safe_site_id  uuid REFERENCES rr_safe_sites(id),
    computed_at           timestamptz DEFAULT now()
);


-- ===================== INDEXES =====================

-- Spatial (GIST)
CREATE INDEX idx_rr_hazard_zones_geom   ON rr_hazard_zones   USING GIST (geom);
CREATE INDEX idx_rr_safe_sites_geom     ON rr_safe_sites     USING GIST (geom);
CREATE INDEX idx_rr_habitations_geom    ON rr_habitations    USING GIST (geom);

-- jsonb (GIN) — containment and key lookups on historical event context
CREATE INDEX idx_rr_hazard_zones_metadata ON rr_hazard_zones USING GIN (metadata);

-- B-tree
CREATE INDEX idx_rr_scores_priority_rank  ON rr_scores (priority_rank);
CREATE INDEX idx_rr_scores_habitation_id  ON rr_scores (habitation_id);


-- ===================== ROW LEVEL SECURITY =====================

-- rr_hazard_zones
ALTER TABLE rr_hazard_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_hazard_zones_anon_read
    ON rr_hazard_zones FOR SELECT TO anon USING (true);

CREATE POLICY rr_hazard_zones_service_all
    ON rr_hazard_zones FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rr_safe_sites
ALTER TABLE rr_safe_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_safe_sites_anon_read
    ON rr_safe_sites FOR SELECT TO anon USING (true);

CREATE POLICY rr_safe_sites_service_all
    ON rr_safe_sites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rr_habitations
ALTER TABLE rr_habitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_habitations_anon_read
    ON rr_habitations FOR SELECT TO anon USING (true);

CREATE POLICY rr_habitations_service_all
    ON rr_habitations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rr_scores
ALTER TABLE rr_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_scores_anon_read
    ON rr_scores FOR SELECT TO anon USING (true);

CREATE POLICY rr_scores_service_all
    ON rr_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Migration 00002: Create rr_* tables
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
--
-- Tables:
--   rr_hazard_zones  — polygons of hazard areas (landslide, flood, etc.)
--   rr_safe_sites    — candidate relocation points with capacity & infra scores
--   rr_habitations   — villages/settlements with population counts
--   rr_scores        — computed priority scores linking habitations → safe sites
-- ============================================================

-- -----------------------------------------------
-- 1. rr_hazard_zones
-- -----------------------------------------------
CREATE TABLE rr_hazard_zones (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    geom         geometry(Polygon, 4326) NOT NULL,
    hazard_type  text NOT NULL,
    intensity    int  NOT NULL CHECK (intensity BETWEEN 1 AND 10),
    source       text NOT NULL CHECK (source IN ('synthetic', 'historical')),
    event_label  text,
    created_at   timestamptz DEFAULT now()
);

-- -----------------------------------------------
-- 2. rr_safe_sites
-- -----------------------------------------------
CREATE TABLE rr_safe_sites (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    geom          geometry(Point, 4326) NOT NULL,
    name          text,
    capacity_max  int     NOT NULL,
    infra_score   numeric,
    created_at    timestamptz DEFAULT now()
);

-- -----------------------------------------------
-- 3. rr_habitations
-- -----------------------------------------------
CREATE TABLE rr_habitations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    geom        geometry(Point, 4326) NOT NULL,
    name        text NOT NULL,
    population  int  NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- -----------------------------------------------
-- 4. rr_scores
-- -----------------------------------------------
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

-- ============================================================
-- Migration 00004: Row Level Security policies
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
--
-- Hackathon demo RLS:
--   • anon         → SELECT only (read the map data, can't mutate)
--   • service_role → full CRUD (backend / admin operations)
-- ============================================================

-- -----------------------------------------------
-- rr_hazard_zones
-- -----------------------------------------------
ALTER TABLE rr_hazard_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_hazard_zones_anon_read
    ON rr_hazard_zones FOR SELECT
    TO anon
    USING (true);

CREATE POLICY rr_hazard_zones_service_all
    ON rr_hazard_zones FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------
-- rr_safe_sites
-- -----------------------------------------------
ALTER TABLE rr_safe_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_safe_sites_anon_read
    ON rr_safe_sites FOR SELECT
    TO anon
    USING (true);

CREATE POLICY rr_safe_sites_service_all
    ON rr_safe_sites FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------
-- rr_habitations
-- -----------------------------------------------
ALTER TABLE rr_habitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_habitations_anon_read
    ON rr_habitations FOR SELECT
    TO anon
    USING (true);

CREATE POLICY rr_habitations_service_all
    ON rr_habitations FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------
-- rr_scores
-- -----------------------------------------------
ALTER TABLE rr_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY rr_scores_anon_read
    ON rr_scores FOR SELECT
    TO anon
    USING (true);

CREATE POLICY rr_scores_service_all
    ON rr_scores FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

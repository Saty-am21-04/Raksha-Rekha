-- ============================================================
-- Migration 00006: rr_hazard_zones.metadata (jsonb)
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
--
-- Historical hazard zones carry measured event context that has no home in the
-- fixed columns — rainfall totals, alert status, event date, source attribution.
-- Rather than widen the table with a column per figure (all NULL for synthetic
-- rows), those observations live in one jsonb document.
--
-- Synthetic rows leave this NULL: they model plausible terrain risk and have no
-- measurements behind them.
-- ============================================================

ALTER TABLE rr_hazard_zones
    ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN rr_hazard_zones.metadata IS
    'Observed event context for historical zones: rainfall_24h_mm, '
    'rainfall_3day_mm, rainfall_5day_mm, orange_alert_issued, event_date, '
    'crown_lon/crown_lat, crown_area_sqm, runout_km. NULL for synthetic zones.';

-- Containment queries like metadata @> '{"orange_alert_issued": true}' and
-- key lookups both benefit; GIN with jsonb_path_ops would be smaller but only
-- supports @>, and we also filter on individual keys.
CREATE INDEX IF NOT EXISTS idx_rr_hazard_zones_metadata
    ON rr_hazard_zones USING GIN (metadata);

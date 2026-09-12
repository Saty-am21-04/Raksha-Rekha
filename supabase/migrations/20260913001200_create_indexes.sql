-- ============================================================
-- Migration 00003: Spatial GIST indexes + btree indexes
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
-- ============================================================

-- GIST indexes for spatial query performance
CREATE INDEX idx_rr_hazard_zones_geom   ON rr_hazard_zones   USING GIST (geom);
CREATE INDEX idx_rr_safe_sites_geom     ON rr_safe_sites     USING GIST (geom);
CREATE INDEX idx_rr_habitations_geom    ON rr_habitations    USING GIST (geom);

-- btree indexes on rr_scores for fast lookups / ordering
CREATE INDEX idx_rr_scores_priority_rank  ON rr_scores (priority_rank);
CREATE INDEX idx_rr_scores_habitation_id  ON rr_scores (habitation_id);

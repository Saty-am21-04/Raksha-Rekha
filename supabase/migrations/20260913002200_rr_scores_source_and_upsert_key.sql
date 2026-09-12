-- ============================================================
-- Migration 00008: make rr_scores hold one row per (habitation, dataset)
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
--
-- rr_scores could not support the compute-scores function as specified:
--
--   1. No `source` column. Scores derived from the synthetic hazard set and the
--      historical set are different numbers for the same habitation, so a
--      single row per habitation cannot represent both. Backtest Mode had no
--      way to ask for "the historical ranking".
--
--   2. No unique constraint. PostgREST upsert (INSERT .. ON CONFLICT) needs a
--      unique index to conflict against. Without one, "upsert" silently appends
--      a new row on every run, so rr_scores would grow without bound and
--      priority_rank would stop being unique within a dataset.
--
--   3. habitation_id was nullable, which both allows a meaningless orphan score
--      and defeats the unique constraint, since Postgres treats NULLs as
--      distinct and would permit unlimited (NULL, 'synthetic') rows.
--
-- rr_scores is empty in this project, so tightening these is non-destructive.
-- No PostGIS is referenced here, so no schema qualification is needed — see
-- 20260913002100 for why that matters elsewhere.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Which hazard dataset a score was computed against
--
-- Mirrors the CHECK on rr_hazard_zones.source so the two cannot drift apart.
-- Default 'synthetic' matches the dashboard's default mode.
-- ------------------------------------------------------------
ALTER TABLE rr_scores
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'synthetic';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rr_scores_source_check'
    ) THEN
        ALTER TABLE rr_scores
            ADD CONSTRAINT rr_scores_source_check
            CHECK (source IN ('synthetic', 'historical'));
    END IF;
END $$;

COMMENT ON COLUMN rr_scores.source IS
    'Hazard dataset this score was computed against; matches rr_hazard_zones.source.';


-- ------------------------------------------------------------
-- 2. A score must belong to a habitation
--
-- Safe to enforce: the table is empty. Guarded so a re-run is a no-op.
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM rr_scores WHERE habitation_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'rr_scores contains rows with NULL habitation_id; resolve them before enforcing NOT NULL';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'rr_scores'
           AND column_name = 'habitation_id'
           AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE rr_scores ALTER COLUMN habitation_id SET NOT NULL;
    END IF;
END $$;


-- ------------------------------------------------------------
-- 3. The upsert target
--
-- One score per habitation per dataset. This is what
-- .upsert(rows, { onConflict: 'habitation_id,source' }) conflicts against, so
-- recomputing overwrites in place instead of accumulating duplicates.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_scores_habitation_source
    ON rr_scores (habitation_id, source);


-- ------------------------------------------------------------
-- 4. Read path for the dashboard: one dataset, ordered by rank
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rr_scores_source_rank
    ON rr_scores (source, priority_rank);


-- ------------------------------------------------------------
-- 5. Verify
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE tablename = 'rr_scores'
           AND indexname = 'idx_rr_scores_habitation_source'
    ) THEN
        RAISE EXCEPTION 'Upsert key idx_rr_scores_habitation_source was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'rr_scores' AND column_name = 'source'
    ) THEN
        RAISE EXCEPTION 'rr_scores.source was not added';
    END IF;

    RAISE NOTICE 'rr_scores is ready for per-dataset upserts';
END $$;

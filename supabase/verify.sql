-- ============================================================
-- Verification script: run after all migrations to confirm
-- PostGIS, tables, indexes, RLS, and seed data are all active.
-- ============================================================

-- 1. PostGIS enabled?
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'postgis';

-- 2. Row counts per table
SELECT 'rr_hazard_zones' AS table_name, count(*) AS row_count FROM rr_hazard_zones
UNION ALL
SELECT 'rr_safe_sites',   count(*) FROM rr_safe_sites
UNION ALL
SELECT 'rr_habitations',  count(*) FROM rr_habitations
UNION ALL
SELECT 'rr_scores',       count(*) FROM rr_scores
ORDER BY table_name;

-- 3. Indexes present?
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename LIKE 'rr_%'
ORDER BY tablename, indexname;

-- 4. RLS enabled on all tables?
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname LIKE 'rr_%' AND relkind = 'r'
ORDER BY relname;

-- 5. Policies defined?
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename LIKE 'rr_%'
ORDER BY tablename, policyname;

-- 6. Quick spatial sanity: bounding box of all hazard zones
SELECT
    ST_XMin(bbox) AS min_lon,
    ST_YMin(bbox) AS min_lat,
    ST_XMax(bbox) AS max_lon,
    ST_YMax(bbox) AS max_lat
FROM (SELECT ST_Extent(geom) AS bbox FROM rr_hazard_zones) sub;

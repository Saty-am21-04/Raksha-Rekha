-- ============================================================
-- Migration 00007: real historical hazard data (Meppadi panchayat, Wayanad)
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
--
-- Replaces the placeholder 'historical' rows from the original seed with the
-- documented geography of two real landslides, and relocates the corridor
-- villages onto their actual coordinates.
--
-- Scope: reads/writes rr_hazard_zones, rr_habitations, rr_safe_sites only.
-- The 12 synthetic zones and the habitations elsewhere in the district are
-- untouched.
--
-- ------------------------------------------------------------
-- WHY EVERY POSTGIS REFERENCE HERE IS SCHEMA-QUALIFIED
-- ------------------------------------------------------------
-- Migration 20260913001000 installs PostGIS with `WITH SCHEMA extensions`, so
-- the geometry/geography types and every ST_* function live in `extensions`,
-- not `public`.
--
-- `supabase db push` applies migrations over a connection whose search_path
-- does not include `extensions`, so a bare `geometry` or `ST_YMax(...)` fails
-- with `type "geometry" does not exist (SQLSTATE 42704)`.
--
-- Note this is specific to migrations. supabase/config.toml sets
-- `extra_search_path = ["public", "extensions"]`, which is why the dashboard's
-- PostgREST queries resolve unqualified PostGIS fine — that setting applies to
-- API requests, not to the migration connection.
--
-- Rather than depend on search_path, this migration names the schema on every
-- type and function. Redundant `::geometry` casts have also been dropped: the
-- geom columns are already `extensions.geometry`, so those casts added nothing
-- but a search_path dependency. Casts to `extensions.geography` are kept, since
-- they are what make ST_Area/ST_Distance/ST_Length return metres.
--
-- ------------------------------------------------------------
-- THREE DELIBERATE DEPARTURES FROM A PURELY ADDITIVE SEED
-- ------------------------------------------------------------
-- 1. The original seed contained three zones already labelled 'Wayanad
--    Landslide 2024', placed around 11.635-11.660 N, 76.020-76.060 E. The real
--    crown is at 11.46544 N, 76.13576 E — roughly 19 km south-east. Keeping
--    both would leave two contradictory versions of one event, so the
--    placeholders are deleted. The delete is bounded to the wrong latitude band
--    so re-running this migration never touches the real row.
--
-- 2. "86,000 m2 impact area" and "8 km runout" cannot describe one polygon:
--    86,000 m2 stretched over 8 km averages ~11 m wide. 86,000 m2 (8.6 ha) is
--    the crown/initiation scar; the runout footprint is necessarily far larger.
--    The polygon below traces the 8 km runout corridor, because that is the
--    area that actually carries risk for the settlements. The crown figure is
--    preserved as metadata.crown_area_sqm rather than discarded, and the
--    polygon's true area is asserted at the end of this file.
--
-- 3. Mundakkai, Chooralmala, Attamala, Vellarimala Colony and Puthumala were
--    already seeded, at the same incorrect northern coordinates. Inserting new
--    rows would duplicate real village names. They are relocated instead, which
--    keeps rr_scores' foreign keys intact. Only these five move; every other
--    habitation is left alone.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Preflight — fail with a clear message if the PostGIS layout differs
--
-- Everything below hard-codes the `extensions` schema. If a future environment
-- installs PostGIS elsewhere, say so plainly instead of emitting a confusing
-- "type does not exist" further down.
-- ------------------------------------------------------------
DO $preflight$
DECLARE
    pg_schema text;
BEGIN
    SELECT extnamespace::regnamespace::text
      INTO pg_schema
      FROM pg_extension
     WHERE extname = 'postgis';

    IF pg_schema IS NULL THEN
        RAISE EXCEPTION
            'PostGIS is not installed. Migration 20260913001000 should have created it.';
    END IF;

    IF pg_schema <> 'extensions' THEN
        RAISE EXCEPTION
            'PostGIS is in schema "%", but this migration qualifies every PostGIS reference as extensions.*. Re-qualify to "%" before applying.',
            pg_schema, pg_schema;
    END IF;

    -- Required by the metadata column added in 20260913002000.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'rr_hazard_zones' AND column_name = 'metadata'
    ) THEN
        RAISE EXCEPTION
            'rr_hazard_zones.metadata is missing. Apply 20260913002000 first.';
    END IF;
END $preflight$;


-- ------------------------------------------------------------
-- 1. Remove the placeholder 2024 zones (wrong location only)
-- ------------------------------------------------------------
DELETE FROM rr_hazard_zones
WHERE source = 'historical'
  AND event_label = 'Wayanad Landslide 2024'
  -- The real footprint tops out near 11.4738 N; placeholders sat above 11.55.
  AND extensions.ST_YMax(geom) > 11.55;


-- ------------------------------------------------------------
-- 2. Wayanad Landslide 2024 — Mundakkai / Chooralmala
--
-- 30 July 2024. Initiated at Punjirimattom above Mundakkai and ran out roughly
-- 8 km down the Punnapuzha channel, through Mundakkai and Chooralmala.
--
-- Geometry is an elongated corridor following the drainage, tapering from about
-- 240 m across at the crown to about 700 m across at the downstream debris fan.
-- It is deliberately not circular: a buffer around the crown would wrongly show
-- the downstream villages as safe.
--
-- Ring order: northern bank from the crown heading downstream (west-north-west),
-- then the southern bank from the debris fan back up to the crown. Coordinates
-- are lon lat, matching WKT and SRID 4326.
--
-- intensity 9/10, justified by the rainfall stored in metadata.
-- ------------------------------------------------------------
INSERT INTO rr_hazard_zones (geom, hazard_type, intensity, source, event_label, metadata)
SELECT
    extensions.ST_GeomFromText(
        'POLYGON((
            76.13576 11.46653, 76.12800 11.46886, 76.11800 11.47108,
            76.10500 11.47281, 76.09000 11.47376, 76.07500 11.47371,
            76.06246 11.47317,
            76.06246 11.46683, 76.07500 11.46829, 76.09000 11.46924,
            76.10500 11.46919, 76.11800 11.46792, 76.12800 11.46614,
            76.13576 11.46435,
            76.13576 11.46653
        ))',
        4326
    ),
    'landslide',
    9,
    'historical',
    'Wayanad Landslide 2024',
    jsonb_build_object(
        'event_date',          '2024-07-30',
        'rainfall_24h_mm',     372.6::numeric,
        'rainfall_3day_mm',    586::numeric,
        'rainfall_5day_mm',    809::numeric,
        'orange_alert_issued', true,
        -- Anchor point the corridor was built from.
        'crown_lon',           76.13576::numeric,
        'crown_lat',           11.46544::numeric,
        -- Initiation scar, not the polygon's area. See note 2 above.
        'crown_area_sqm',      86000::numeric,
        'runout_km',           8::numeric,
        'affected_villages',   jsonb_build_array(
            'Punjirimattom', 'Mundakkai', 'Chooralmala', 'Attamala', 'Vellarimala'
        ),
        'panchayat',           'Meppadi',
        'district',            'Wayanad'
    )
WHERE NOT EXISTS (
    SELECT 1 FROM rr_hazard_zones
    WHERE event_label = 'Wayanad Landslide 2024'
      AND extensions.ST_YMax(geom) <= 11.55
);


-- ------------------------------------------------------------
-- 3. Puthumala Landslide 2019
--
-- 8 August 2019, same Meppadi panchayat, roughly 2 km north of the 2024
-- corridor and not overlapping it. Its value here is the recurrence signal: a
-- historical-frequency factor computed before July 2024 should already have
-- flagged this slope system.
--
-- Rainfall figures are deliberately null — this migration only records
-- measurements it can stand behind, and inventing them would defeat the point
-- of the metadata column.
-- ------------------------------------------------------------
INSERT INTO rr_hazard_zones (geom, hazard_type, intensity, source, event_label, metadata)
SELECT
    extensions.ST_GeomFromText(
        'POLYGON((
            76.10900 11.49220, 76.11900 11.49400,
            76.11900 11.49670, 76.10900 11.49490,
            76.10900 11.49220
        ))',
        4326
    ),
    'landslide',
    6,
    'historical',
    'Puthumala Landslide 2019',
    jsonb_build_object(
        'event_date',        '2019-08-08',
        'panchayat',         'Meppadi',
        'district',          'Wayanad',
        'recurrence_note',   'Same slope system as the 2024 Mundakkai-Chooralmala failure, ~2 km north. Establishes repeat failure on this terrain five years earlier.',
        'rainfall_24h_mm',   null::numeric,
        'rainfall_3day_mm',  null::numeric,
        'rainfall_5day_mm',  null::numeric
    )
WHERE NOT EXISTS (
    SELECT 1 FROM rr_hazard_zones WHERE event_label = 'Puthumala Landslide 2019'
);


-- ------------------------------------------------------------
-- 4. Relocate the corridor villages onto real coordinates
--
-- Populations are revised to published estimates for these hill settlements.
-- Guarded on the old latitude band so this is a no-op once applied. Only geom
-- and population change; ids are untouched, so rr_scores.habitation_id keeps
-- pointing at the same rows.
-- ------------------------------------------------------------
UPDATE rr_habitations AS h
SET geom       = v.geom,
    population = v.population
FROM (VALUES
    -- Inside the 2024 runout corridor, upstream to downstream
    ('Vellarimala Colony', extensions.ST_SetSRID(extensions.ST_MakePoint(76.13100, 11.46600), 4326),  210),
    ('Mundakkai',          extensions.ST_SetSRID(extensions.ST_MakePoint(76.12900, 11.46720), 4326),  480),
    ('Attamala',           extensions.ST_SetSRID(extensions.ST_MakePoint(76.12350, 11.46800), 4326),  330),
    ('Chooralmala',        extensions.ST_SetSRID(extensions.ST_MakePoint(76.11500, 11.46980), 4326), 1350),
    -- Inside the 2019 Puthumala zone
    ('Puthumala',          extensions.ST_SetSRID(extensions.ST_MakePoint(76.11400, 11.49450), 4326),  260)
) AS v(name, geom, population)
WHERE h.name = v.name
  AND extensions.ST_Y(h.geom) > 11.55;   -- only the mis-placed originals


-- ------------------------------------------------------------
-- 5. Punjirimattom — the crown hamlet, not in the original seed
-- ------------------------------------------------------------
INSERT INTO rr_habitations (geom, name, population)
SELECT
    extensions.ST_SetSRID(extensions.ST_MakePoint(76.13500, 11.46580), 4326),
    'Punjirimattom',
    148
WHERE NOT EXISTS (
    SELECT 1 FROM rr_habitations WHERE name = 'Punjirimattom'
);


-- ------------------------------------------------------------
-- 6. Relocation sites clear of the runout path
--
-- The corridor drains west, so a site directly downstream is not a refuge.
-- These sit north (uphill toward Meppadi town), east of the crown (upstream),
-- and south of the channel respectively.
-- ------------------------------------------------------------
INSERT INTO rr_safe_sites (geom, name, capacity_max, infra_score)
SELECT v.geom, v.name, v.capacity_max, v.infra_score
FROM (VALUES
    (extensions.ST_SetSRID(extensions.ST_MakePoint(76.13520, 11.53850), 4326), 'Meppadi Govt. HSS Relief Camp', 400, 0.82::numeric),
    (extensions.ST_SetSRID(extensions.ST_MakePoint(76.16100, 11.47600), 4326), 'Ripon Estate Community Centre', 220, 0.65::numeric),
    (extensions.ST_SetSRID(extensions.ST_MakePoint(76.09500, 11.45300), 4326), 'Aranamala Estate Ground',       160, 0.55::numeric)
) AS v(geom, name, capacity_max, infra_score)
WHERE NOT EXISTS (
    SELECT 1 FROM rr_safe_sites s WHERE s.name = v.name
);


-- ------------------------------------------------------------
-- 7. Assertions — fail loudly rather than render wrong geometry
--
-- Any RAISE here aborts the migration and rolls the whole file back, so a bad
-- polygon can never reach the dashboard.
-- ------------------------------------------------------------
DO $verify$
DECLARE
    z2024       extensions.geometry;
    z2019       extensions.geometry;
    n_2024      int;
    n_2019      int;
    area_sqm    numeric;
    mean_width  numeric;
    runout_km   numeric;
    gap_km      numeric;
    n_inside    int;
    n_sites_ok  int;
    rain_24h    text;
BEGIN
    -- Exactly one row per historical event, or the delete/insert guards drifted.
    SELECT count(*) INTO n_2024 FROM rr_hazard_zones
     WHERE event_label = 'Wayanad Landslide 2024';
    SELECT count(*) INTO n_2019 FROM rr_hazard_zones
     WHERE event_label = 'Puthumala Landslide 2019';

    IF n_2024 <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly 1 "Wayanad Landslide 2024" zone, found %. Placeholder rows may not have been removed.', n_2024;
    END IF;
    IF n_2019 <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly 1 "Puthumala Landslide 2019" zone, found %.', n_2019;
    END IF;

    SELECT geom, metadata->>'rainfall_24h_mm'
      INTO z2024, rain_24h
      FROM rr_hazard_zones
     WHERE event_label = 'Wayanad Landslide 2024';

    SELECT geom INTO z2019 FROM rr_hazard_zones
     WHERE event_label = 'Puthumala Landslide 2019';

    -- Rainfall must be stored, not merely mentioned in a comment.
    IF rain_24h IS NULL OR rain_24h::numeric <> 372.6 THEN
        RAISE EXCEPTION
            'metadata.rainfall_24h_mm is %, expected 372.6 — intensity 9 loses its justification.',
            coalesce(rain_24h, 'NULL');
    END IF;

    -- Both rings must be valid, simple polygons with the project SRID.
    IF NOT extensions.ST_IsValid(z2024) THEN
        RAISE EXCEPTION '2024 polygon invalid: %', extensions.ST_IsValidReason(z2024);
    END IF;
    IF NOT extensions.ST_IsValid(z2019) THEN
        RAISE EXCEPTION '2019 polygon invalid: %', extensions.ST_IsValidReason(z2019);
    END IF;
    IF extensions.ST_SRID(z2024) <> 4326 OR extensions.ST_SRID(z2019) <> 4326 THEN
        RAISE EXCEPTION 'Historical zones must use SRID 4326 to match the rr_* columns';
    END IF;

    -- The two events must be near neighbours but distinct terrain.
    IF extensions.ST_Intersects(z2024, z2019) THEN
        RAISE EXCEPTION
            'Historical zones overlap; the 2019 zone must sit apart from the 2024 corridor';
    END IF;

    gap_km := extensions.ST_Distance(
                  z2024::extensions.geography,
                  z2019::extensions.geography
              ) / 1000.0;
    IF gap_km > 4 THEN
        RAISE EXCEPTION 'Puthumala zone is % km from the 2024 corridor, expected ~2 km',
            round(gap_km, 2);
    END IF;

    -- Runout length along the corridor's long axis.
    runout_km := extensions.ST_Length(
        extensions.ST_MakeLine(
            extensions.ST_SetSRID(extensions.ST_MakePoint(76.13576, 11.46544), 4326),
            extensions.ST_SetSRID(extensions.ST_MakePoint(76.06246, 11.47000), 4326)
        )::extensions.geography
    ) / 1000.0;
    IF runout_km < 7 OR runout_km > 9 THEN
        RAISE EXCEPTION 'Runout axis is % km, expected ~8 km', round(runout_km, 2);
    END IF;

    -- Corridor must be elongated, not a blob.
    area_sqm   := extensions.ST_Area(z2024::extensions.geography);
    mean_width := area_sqm / (runout_km * 1000);
    IF (runout_km * 1000) / mean_width < 10 THEN
        RAISE EXCEPTION
            'Corridor is not elongated enough: % m2 over % km is % m mean width',
            round(area_sqm), round(runout_km, 2), round(mean_width);
    END IF;

    -- Every corridor village must actually fall inside the 2024 footprint,
    -- otherwise the backtest would show them unaffected.
    SELECT count(*) INTO n_inside
      FROM rr_habitations
     WHERE name IN ('Punjirimattom', 'Mundakkai', 'Chooralmala', 'Attamala', 'Vellarimala Colony')
       AND extensions.ST_Within(geom, z2024);
    IF n_inside <> 5 THEN
        RAISE EXCEPTION
            'Only % of 5 corridor villages fall inside the 2024 polygon', n_inside;
    END IF;

    -- Puthumala must sit in the 2019 zone, carrying the recurrence story.
    IF NOT EXISTS (
        SELECT 1 FROM rr_habitations
         WHERE name = 'Puthumala' AND extensions.ST_Within(geom, z2019)
    ) THEN
        RAISE EXCEPTION 'Puthumala habitation is not inside the 2019 zone';
    END IF;

    -- No duplicate village names introduced by the relocation.
    IF EXISTS (
        SELECT 1 FROM rr_habitations
         GROUP BY name HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate habitation names present after seeding';
    END IF;

    -- New relocation sites must be clear of both footprints.
    SELECT count(*) INTO n_sites_ok
      FROM rr_safe_sites
     WHERE name IN ('Meppadi Govt. HSS Relief Camp', 'Ripon Estate Community Centre', 'Aranamala Estate Ground')
       AND NOT extensions.ST_Intersects(geom, z2024)
       AND NOT extensions.ST_Intersects(geom, z2019);
    IF n_sites_ok <> 3 THEN
        RAISE EXCEPTION
            'Only % of 3 new safe sites are clear of the hazard footprints', n_sites_ok;
    END IF;

    RAISE NOTICE
        'Historical seed OK — 2024 corridor % m2 (% m mean width) over % km runout, Puthumala % km away, % villages inside',
        round(area_sqm), round(mean_width), round(runout_km, 2), round(gap_km, 2), n_inside;
END $verify$;

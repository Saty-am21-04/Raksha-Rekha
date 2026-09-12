-- ============================================================
-- Migration 00007: real historical hazard data (Meppadi panchayat, Wayanad)
-- Project: raksha-rekha (SIH 2026 Disaster-Relocation Prototype)
--
-- Replaces the placeholder 'historical' rows from the original seed with the
-- documented geography of two real landslides, and relocates the corridor
-- villages onto their actual coordinates.
--
-- Scope: reads/writes rr_hazard_zones, rr_habitations, rr_safe_sites only.
-- The ~12 synthetic zones and the habitations elsewhere in the district are
-- untouched.
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
-- 1. Remove the placeholder 2024 zones (wrong location only)
-- ------------------------------------------------------------
DELETE FROM rr_hazard_zones
WHERE source = 'historical'
  AND event_label = 'Wayanad Landslide 2024'
  -- The real footprint tops out near 11.4738 N; placeholders sat above 11.55.
  AND ST_YMax(geom::geometry) > 11.55;


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
-- intensity 9/10, justified by the rainfall stored in metadata.
-- ------------------------------------------------------------
INSERT INTO rr_hazard_zones (geom, hazard_type, intensity, source, event_label, metadata)
SELECT
    ST_GeomFromText(
        'POLYGON((' ||
        -- northern bank, crown heading downstream (west-north-west)
        '76.13576 11.46653, 76.12800 11.46886, 76.11800 11.47108, ' ||
        '76.10500 11.47281, 76.09000 11.47376, 76.07500 11.47371, ' ||
        '76.06246 11.47317, ' ||
        -- southern bank, debris fan back up to the crown
        '76.06246 11.46683, 76.07500 11.46829, 76.09000 11.46924, ' ||
        '76.10500 11.46919, 76.11800 11.46792, 76.12800 11.46614, ' ||
        '76.13576 11.46435, ' ||
        -- close the ring
        '76.13576 11.46653))',
        4326
    ),
    'landslide',
    9,
    'historical',
    'Wayanad Landslide 2024',
    jsonb_build_object(
        'event_date',          '2024-07-30',
        'rainfall_24h_mm',     372.6,
        'rainfall_3day_mm',    586,
        'rainfall_5day_mm',    809,
        'orange_alert_issued', true,
        -- Anchor point the corridor was built from.
        'crown_lon',           76.13576,
        'crown_lat',           11.46544,
        -- Initiation scar, not the polygon's area. See note 2 above.
        'crown_area_sqm',      86000,
        'runout_km',           8,
        'affected_villages',   jsonb_build_array(
            'Punjirimattom', 'Mundakkai', 'Chooralmala', 'Attamala', 'Vellarimala'
        ),
        'panchayat',           'Meppadi',
        'district',            'Wayanad'
    )
WHERE NOT EXISTS (
    SELECT 1 FROM rr_hazard_zones
    WHERE event_label = 'Wayanad Landslide 2024'
      AND ST_YMax(geom::geometry) <= 11.55
);


-- ------------------------------------------------------------
-- 3. Puthumala Landslide 2019
--
-- 8 August 2019, same Meppadi panchayat, roughly 2 km north of the 2024
-- corridor and not overlapping it. Its value here is the recurrence signal: a
-- historical-frequency factor computed before July 2024 should already have
-- flagged this slope system.
--
-- Rainfall figures are deliberately absent — this migration only records
-- measurements it can stand behind, and inventing them would defeat the point
-- of the metadata column.
-- ------------------------------------------------------------
INSERT INTO rr_hazard_zones (geom, hazard_type, intensity, source, event_label, metadata)
SELECT
    ST_GeomFromText(
        'POLYGON((' ||
        '76.10900 11.49220, 76.11900 11.49400, ' ||
        '76.11900 11.49670, 76.10900 11.49490, ' ||
        '76.10900 11.49220))',
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
        'rainfall_24h_mm',   null,
        'rainfall_3day_mm',  null,
        'rainfall_5day_mm',  null
    )
WHERE NOT EXISTS (
    SELECT 1 FROM rr_hazard_zones WHERE event_label = 'Puthumala Landslide 2019'
);


-- ------------------------------------------------------------
-- 4. Relocate the corridor villages onto real coordinates
--
-- Populations are revised to published estimates for these hill settlements.
-- Guarded on the old latitude band so this is a no-op once applied.
-- ------------------------------------------------------------
UPDATE rr_habitations AS h
SET geom       = v.geom,
    population = v.population
FROM (VALUES
    -- Inside the 2024 runout corridor, upstream to downstream
    ('Vellarimala Colony', ST_SetSRID(ST_MakePoint(76.13100, 11.46600), 4326),  210),
    ('Mundakkai',          ST_SetSRID(ST_MakePoint(76.12900, 11.46720), 4326),  480),
    ('Attamala',           ST_SetSRID(ST_MakePoint(76.12350, 11.46800), 4326),  330),
    ('Chooralmala',        ST_SetSRID(ST_MakePoint(76.11500, 11.46980), 4326), 1350),
    -- Inside the 2019 Puthumala zone
    ('Puthumala',          ST_SetSRID(ST_MakePoint(76.11400, 11.49450), 4326),  260)
) AS v(name, geom, population)
WHERE h.name = v.name
  AND ST_Y(h.geom::geometry) > 11.55;   -- only the mis-placed originals


-- ------------------------------------------------------------
-- 5. Punjirimattom — the crown hamlet, not in the original seed
-- ------------------------------------------------------------
INSERT INTO rr_habitations (geom, name, population)
SELECT ST_SetSRID(ST_MakePoint(76.13500, 11.46580), 4326), 'Punjirimattom', 148
WHERE NOT EXISTS (
    SELECT 1 FROM rr_habitations WHERE name = 'Punjirimattom'
);


-- ------------------------------------------------------------
-- 6. Relocation sites clear of the runout path
--
-- The corridor drains west, so a site directly downstream is not a refuge.
-- These sit north (uphill toward Meppadi town), south of the channel, and east
-- of the crown (upstream) respectively.
-- ------------------------------------------------------------
INSERT INTO rr_safe_sites (geom, name, capacity_max, infra_score)
SELECT * FROM (VALUES
    (ST_SetSRID(ST_MakePoint(76.13520, 11.53850), 4326), 'Meppadi Govt. HSS Relief Camp',   400, 0.82),
    (ST_SetSRID(ST_MakePoint(76.16100, 11.47600), 4326), 'Ripon Estate Community Centre',   220, 0.65),
    (ST_SetSRID(ST_MakePoint(76.09500, 11.45300), 4326), 'Aranamala Estate Ground',         160, 0.55)
) AS v(geom, name, capacity_max, infra_score)
WHERE NOT EXISTS (
    SELECT 1 FROM rr_safe_sites WHERE rr_safe_sites.name = v.name
);


-- ------------------------------------------------------------
-- 7. Assertions — fail loudly rather than render wrong geometry
-- ------------------------------------------------------------
DO $$
DECLARE
    z2024      geometry;
    z2019      geometry;
    area_sqm   numeric;
    runout_km  numeric;
    gap_km     numeric;
    n_inside   int;
    n_sites_ok int;
BEGIN
    SELECT geom INTO z2024 FROM rr_hazard_zones
     WHERE event_label = 'Wayanad Landslide 2024';
    SELECT geom INTO z2019 FROM rr_hazard_zones
     WHERE event_label = 'Puthumala Landslide 2019';

    IF z2024 IS NULL THEN
        RAISE EXCEPTION 'Wayanad Landslide 2024 zone missing after seed';
    END IF;
    IF z2019 IS NULL THEN
        RAISE EXCEPTION 'Puthumala Landslide 2019 zone missing after seed';
    END IF;

    -- Both rings must be valid, simple polygons.
    IF NOT ST_IsValid(z2024) THEN
        RAISE EXCEPTION '2024 polygon invalid: %', ST_IsValidReason(z2024);
    END IF;
    IF NOT ST_IsValid(z2019) THEN
        RAISE EXCEPTION '2019 polygon invalid: %', ST_IsValidReason(z2019);
    END IF;

    -- The two events must be near neighbours but distinct terrain.
    IF ST_Intersects(z2024, z2019) THEN
        RAISE EXCEPTION 'Historical zones overlap; 2019 zone must sit apart from the 2024 corridor';
    END IF;

    gap_km := ST_Distance(z2024::geography, z2019::geography) / 1000.0;
    IF gap_km > 4 THEN
        RAISE EXCEPTION 'Puthumala zone is % km from the 2024 corridor, expected ~2 km', round(gap_km, 2);
    END IF;

    -- Runout length along the corridor's long axis.
    runout_km := ST_Length(
        ST_MakeLine(
            ST_SetSRID(ST_MakePoint(76.13576, 11.46544), 4326),
            ST_SetSRID(ST_MakePoint(76.06246, 11.47000), 4326)
        )::geography
    ) / 1000.0;
    IF runout_km < 7 OR runout_km > 9 THEN
        RAISE EXCEPTION 'Runout axis is % km, expected ~8 km', round(runout_km, 2);
    END IF;

    -- Corridor must be elongated, not a blob: length well over its mean width.
    area_sqm := ST_Area(z2024::geography);
    IF (runout_km * 1000) / (area_sqm / (runout_km * 1000)) < 10 THEN
        RAISE EXCEPTION 'Corridor is not elongated enough (area % m2 over % km)',
            round(area_sqm), round(runout_km, 2);
    END IF;

    -- Every corridor village must actually fall inside the 2024 footprint,
    -- otherwise the backtest would show them unaffected.
    SELECT count(*) INTO n_inside
      FROM rr_habitations
     WHERE name IN ('Punjirimattom', 'Mundakkai', 'Chooralmala', 'Attamala', 'Vellarimala Colony')
       AND ST_Within(geom::geometry, z2024);
    IF n_inside <> 5 THEN
        RAISE EXCEPTION 'Only % of 5 corridor villages fall inside the 2024 polygon', n_inside;
    END IF;

    -- Puthumala must sit in the 2019 zone, carrying the recurrence story.
    IF NOT EXISTS (
        SELECT 1 FROM rr_habitations
         WHERE name = 'Puthumala' AND ST_Within(geom::geometry, z2019)
    ) THEN
        RAISE EXCEPTION 'Puthumala habitation is not inside the 2019 zone';
    END IF;

    -- New relocation sites must be clear of both footprints.
    SELECT count(*) INTO n_sites_ok
      FROM rr_safe_sites
     WHERE name IN ('Meppadi Govt. HSS Relief Camp', 'Ripon Estate Community Centre', 'Aranamala Estate Ground')
       AND NOT ST_Intersects(geom::geometry, z2024)
       AND NOT ST_Intersects(geom::geometry, z2019);
    IF n_sites_ok <> 3 THEN
        RAISE EXCEPTION 'Only % of 3 new safe sites are clear of the hazard footprints', n_sites_ok;
    END IF;

    RAISE NOTICE 'Historical seed OK — 2024 corridor % m2 over % km runout, Puthumala % km away, % villages inside',
        round(area_sqm), round(runout_km, 2), round(gap_km, 2), n_inside;
END $$;

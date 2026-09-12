-- ============================================================
-- Seed: Wayanad, Kerala disaster-relocation demo data
-- Project: raksha-rekha (SIH 2026)
--
-- Region: ~11.60-11.72°N, 76.00-76.12°E (Wayanad district)
--
-- 15 hazard zones  (12 synthetic + 3 historical "Wayanad Landslide 2024")
-- 10 safe sites    (capacity 50-500, infra_score 0.3-0.95)
-- 40 habitations   (population 20-2000)
-- ============================================================

-- -----------------------------------------------
-- HAZARD ZONES — 12 synthetic
-- Each polygon is a small ~0.01-0.02° quad (roughly 1-2 km²)
-- -----------------------------------------------
INSERT INTO rr_hazard_zones (geom, hazard_type, intensity, source, event_label) VALUES

-- S1: flood zone, low-lying area near Mananthavady
(ST_GeomFromText('POLYGON((76.005 11.630, 76.020 11.630, 76.020 11.640, 76.005 11.640, 76.005 11.630))', 4326),
 'flood', 6, 'synthetic', NULL),

-- S2: landslide zone, steep terrain above Meppadi
(ST_GeomFromText('POLYGON((76.040 11.650, 76.055 11.650, 76.055 11.665, 76.040 11.665, 76.040 11.650))', 4326),
 'landslide', 8, 'synthetic', NULL),

-- S3: cloudburst, higher elevation
(ST_GeomFromText('POLYGON((76.060 11.680, 76.075 11.680, 76.075 11.695, 76.060 11.695, 76.060 11.680))', 4326),
 'cloudburst', 7, 'synthetic', NULL),

-- S4: flood, near river confluence
(ST_GeomFromText('POLYGON((76.010 11.610, 76.025 11.610, 76.025 11.625, 76.010 11.625, 76.010 11.610))', 4326),
 'flood', 5, 'synthetic', NULL),

-- S5: landslide, moderate slope
(ST_GeomFromText('POLYGON((76.030 11.670, 76.045 11.670, 76.045 11.685, 76.030 11.685, 76.030 11.670))', 4326),
 'landslide', 4, 'synthetic', NULL),

-- S6: coastal_erosion, western edge (hypothetical for demo)
(ST_GeomFromText('POLYGON((76.000 11.600, 76.012 11.600, 76.012 11.615, 76.000 11.615, 76.000 11.600))', 4326),
 'coastal_erosion', 3, 'synthetic', NULL),

-- S7: flood, wide floodplain
(ST_GeomFromText('POLYGON((76.015 11.655, 76.035 11.655, 76.035 11.670, 76.015 11.670, 76.015 11.655))', 4326),
 'flood', 7, 'synthetic', NULL),

-- S8: landslide, ridge zone
(ST_GeomFromText('POLYGON((76.070 11.700, 76.085 11.700, 76.085 11.715, 76.070 11.715, 76.070 11.700))', 4326),
 'landslide', 9, 'synthetic', NULL),

-- S9: cloudburst, narrow valley
(ST_GeomFromText('POLYGON((76.050 11.620, 76.062 11.620, 76.062 11.635, 76.050 11.635, 76.050 11.620))', 4326),
 'cloudburst', 5, 'synthetic', NULL),

-- S10: flood, seasonal wetland
(ST_GeomFromText('POLYGON((76.025 11.690, 76.040 11.690, 76.040 11.705, 76.025 11.705, 76.025 11.690))', 4326),
 'flood', 4, 'synthetic', NULL),

-- S11: landslide, deforested patch
(ST_GeomFromText('POLYGON((76.080 11.660, 76.095 11.660, 76.095 11.675, 76.080 11.675, 76.080 11.660))', 4326),
 'landslide', 6, 'synthetic', NULL),

-- S12: cloudburst, catchment head
(ST_GeomFromText('POLYGON((76.055 11.710, 76.068 11.710, 76.068 11.722, 76.055 11.722, 76.055 11.710))', 4326),
 'cloudburst', 8, 'synthetic', NULL);


-- -----------------------------------------------
-- HAZARD ZONES — 3 historical (Wayanad Landslide 2024)
-- Modeled around Chooralmala–Mundakkai corridor
-- Higher intensities reflecting the actual disaster zone
-- -----------------------------------------------
INSERT INTO rr_hazard_zones (geom, hazard_type, intensity, source, event_label) VALUES

-- H1: Mundakkai slide path — catastrophic
(ST_GeomFromText('POLYGON((76.045 11.640, 76.060 11.640, 76.060 11.655, 76.045 11.655, 76.045 11.640))', 4326),
 'landslide', 10, 'historical', 'Wayanad Landslide 2024'),

-- H2: Chooralmala upper debris fan
(ST_GeomFromText('POLYGON((76.035 11.645, 76.050 11.645, 76.050 11.660, 76.035 11.660, 76.035 11.645))', 4326),
 'landslide', 9, 'historical', 'Wayanad Landslide 2024'),

-- H3: downstream flood-debris zone post-slide
(ST_GeomFromText('POLYGON((76.020 11.635, 76.040 11.635, 76.040 11.650, 76.020 11.650, 76.020 11.635))', 4326),
 'landslide', 8, 'historical', 'Wayanad Landslide 2024');


-- -----------------------------------------------
-- SAFE SITES — 10 candidate relocation points
-- -----------------------------------------------
INSERT INTO rr_safe_sites (geom, name, capacity_max, infra_score) VALUES
(ST_SetSRID(ST_MakePoint(76.070, 11.620), 4326), 'Kalpetta Community Hall',       500, 0.92),
(ST_SetSRID(ST_MakePoint(76.033, 11.710), 4326), 'Mananthavady School Ground',    350, 0.85),
(ST_SetSRID(ST_MakePoint(76.090, 11.650), 4326), 'Bathery Relief Camp',           200, 0.78),
(ST_SetSRID(ST_MakePoint(76.015, 11.680), 4326), 'Panamaram Open Ground',         150, 0.65),
(ST_SetSRID(ST_MakePoint(76.055, 11.700), 4326), 'Thirunelli Temple Grounds',     100, 0.55),
(ST_SetSRID(ST_MakePoint(76.080, 11.690), 4326), 'Pulpally High School',          300, 0.88),
(ST_SetSRID(ST_MakePoint(76.045, 11.615), 4326), 'Meppadi Community Center',      250, 0.72),
(ST_SetSRID(ST_MakePoint(76.098, 11.720), 4326), 'Noolpuzha Panchayat Hall',       80, 0.45),
(ST_SetSRID(ST_MakePoint(76.010, 11.645), 4326), 'Vellamunda Church Hall',          50, 0.30),
(ST_SetSRID(ST_MakePoint(76.062, 11.665), 4326), 'Ambalavayal Heritage Ground',   450, 0.95);


-- -----------------------------------------------
-- HABITATIONS — 40 settlements scattered across Wayanad
-- population range: 20 – 2000
-- -----------------------------------------------
INSERT INTO rr_habitations (geom, name, population) VALUES
-- cluster 1: near Meppadi / Chooralmala (disaster corridor)
(ST_SetSRID(ST_MakePoint(76.048, 11.648), 4326), 'Mundakkai',              420),
(ST_SetSRID(ST_MakePoint(76.042, 11.652), 4326), 'Chooralmala',            680),
(ST_SetSRID(ST_MakePoint(76.050, 11.643), 4326), 'Attamala',               310),
(ST_SetSRID(ST_MakePoint(76.038, 11.658), 4326), 'Vellarimala Colony',     150),
(ST_SetSRID(ST_MakePoint(76.055, 11.638), 4326), 'Puthumala',              240),
(ST_SetSRID(ST_MakePoint(76.044, 11.662), 4326), 'Meppadi Town',          1800),

-- cluster 2: Kalpetta area
(ST_SetSRID(ST_MakePoint(76.075, 11.625), 4326), 'Kalpetta',              2000),
(ST_SetSRID(ST_MakePoint(76.068, 11.618), 4326), 'Kalpetta South',         900),
(ST_SetSRID(ST_MakePoint(76.080, 11.630), 4326), 'Poothadi',               550),
(ST_SetSRID(ST_MakePoint(76.072, 11.635), 4326), 'Vythiri Junction',       780),

-- cluster 3: Mananthavady
(ST_SetSRID(ST_MakePoint(76.008, 11.635), 4326), 'Mananthavady',          1500),
(ST_SetSRID(ST_MakePoint(76.012, 11.628), 4326), 'Nallanad',               350),
(ST_SetSRID(ST_MakePoint(76.018, 11.640), 4326), 'Edavaka',                280),
(ST_SetSRID(ST_MakePoint(76.005, 11.620), 4326), 'Thirunelly Nagar',       120),

-- cluster 4: Panamaram / northern
(ST_SetSRID(ST_MakePoint(76.020, 11.675), 4326), 'Panamaram',              950),
(ST_SetSRID(ST_MakePoint(76.025, 11.682), 4326), 'Panamaram East',         400),
(ST_SetSRID(ST_MakePoint(76.015, 11.668), 4326), 'Kaniyambetta',           580),
(ST_SetSRID(ST_MakePoint(76.028, 11.692), 4326), 'Thavinjal',              320),

-- cluster 5: Bathery
(ST_SetSRID(ST_MakePoint(76.085, 11.655), 4326), 'Sultan Bathery',        1900),
(ST_SetSRID(ST_MakePoint(76.092, 11.660), 4326), 'Nenmeni',                650),
(ST_SetSRID(ST_MakePoint(76.088, 11.648), 4326), 'Ambalavayal',            720),
(ST_SetSRID(ST_MakePoint(76.095, 11.668), 4326), 'Cheeral',                180),

-- cluster 6: Pulpally / eastern hills
(ST_SetSRID(ST_MakePoint(76.082, 11.695), 4326), 'Pulpally',               850),
(ST_SetSRID(ST_MakePoint(76.078, 11.688), 4326), 'Mullankolly',            430),
(ST_SetSRID(ST_MakePoint(76.075, 11.702), 4326), 'Irulam',                 210),
(ST_SetSRID(ST_MakePoint(76.088, 11.698), 4326), 'Muttil',                 600),

-- cluster 7: Thirunelli / northwest
(ST_SetSRID(ST_MakePoint(76.050, 11.705), 4326), 'Thirunelli',             160),
(ST_SetSRID(ST_MakePoint(76.058, 11.712), 4326), 'Tholpetty',              90),
(ST_SetSRID(ST_MakePoint(76.045, 11.698), 4326), 'Kuruva Island Area',      45),
(ST_SetSRID(ST_MakePoint(76.062, 11.718), 4326), 'Begur',                  130),

-- cluster 8: scattered / rural
(ST_SetSRID(ST_MakePoint(76.035, 11.615), 4326), 'Vaduvanchal',            380),
(ST_SetSRID(ST_MakePoint(76.022, 11.605), 4326), 'Periya',                 520),
(ST_SetSRID(ST_MakePoint(76.003, 11.608), 4326), 'Tharuvana',               75),
(ST_SetSRID(ST_MakePoint(76.030, 11.625), 4326), 'Nadavayal',              290),

-- cluster 9: ridgeline hamlets
(ST_SetSRID(ST_MakePoint(76.065, 11.685), 4326), 'Meenangadi',             700),
(ST_SetSRID(ST_MakePoint(76.060, 11.672), 4326), 'Pozhuthana',             460),
(ST_SetSRID(ST_MakePoint(76.070, 11.678), 4326), 'Kenichira',              340),
(ST_SetSRID(ST_MakePoint(76.055, 11.660), 4326), 'Pinangode',              530),

-- cluster 10: small tribal hamlets
(ST_SetSRID(ST_MakePoint(76.098, 11.710), 4326), 'Noolpuzha',              200),
(ST_SetSRID(ST_MakePoint(76.042, 11.720), 4326), 'Kattikulam',              20),
(ST_SetSRID(ST_MakePoint(76.095, 11.680), 4326), 'Chethalayam',             65);

# Raksha Rekha 🛡️

**SIH 2026 — Disaster-Relocation Planning Prototype**

A geospatial decision-support system for prioritizing habitation relocation from hazard-prone zones. Built on Supabase + PostGIS.

## Database Architecture

| Table | Purpose | Seed Rows |
|-------|---------|-----------|
| `rr_hazard_zones` | Polygonal hazard areas (landslide, flood, cloudburst, coastal erosion) | 14 |
| `rr_safe_sites` | Candidate relocation points with capacity & infrastructure scores | 13 |
| `rr_habitations` | Settlements/villages with population data | 42 |
| `rr_scores` | Computed priority scores linking habitations → safe sites | 0 (computed) |

### Region

Synthetic planning data covers **Wayanad, Kerala** (~11.6–11.72°N, 76.0–76.1°E): 12 hazard zones, 10 safe sites, 36 habitations.

Two **historical** zones sit further south in Meppadi panchayat, on the real coordinates of the events they record:

| Event | `event_label` | Intensity | Footprint |
|-------|---------------|-----------|-----------|
| Wayanad Landslide 2024 | `Wayanad Landslide 2024` | 9 | 8 km runout corridor from the Punjirimattom crown (76.13576°E, 11.46544°N) through Mundakkai and Chooralmala |
| Puthumala Landslide 2019 | `Puthumala Landslide 2019` | 6 | Smaller zone ~2.2 km north, establishing repeat failure on the same slope system |

Six habitations sit inside these footprints — Punjirimattom, Vellarimala Colony, Mundakkai, Attamala, Chooralmala (2024) and Puthumala (2019) — plus 3 relocation sites positioned clear of the runout path.

Observed event context (rainfall totals, alert status, crown geometry) is stored in `rr_hazard_zones.metadata` as `jsonb`; synthetic zones leave it `NULL`.

## Setup

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for local Supabase)

### Run Locally

```bash
# Start local Supabase
supabase start

# Apply migrations (schema + seed data)
supabase db reset

# Verify everything
psql "$DATABASE_URL" -f supabase/verify.sql
```

### Migration Files

```
supabase/migrations/
├── 00001_enable_postgis.sql              # PostGIS extension
├── 00002_create_tables.sql               # 4 rr_* tables
├── 00003_create_indexes.sql              # GIST + btree indexes
├── 00004_enable_rls.sql                  # Row Level Security policies
├── 00005_seed_wayanad_data.sql           # Synthetic demo data (Wayanad region)
├── 00006_add_hazard_zone_metadata.sql    # rr_hazard_zones.metadata jsonb + GIN
└── 00007_seed_historical_wayanad_events.sql
                                          # Real 2024 + 2019 landslide geography;
                                          # replaces the placeholder historical
                                          # rows and relocates corridor villages
```

Migration 00007 ends in a `DO` block that asserts its own geometry — ring
validity, non-overlap of the two events, ~8 km runout, every corridor village
inside the 2024 footprint, every new safe site clear of it. A bad polygon aborts
the migration instead of quietly rendering wrong.

### Reference

- `supabase/schema.sql` — Full schema in one file (read-only reference)
- `supabase/verify.sql` — Post-migration verification queries

## Security

- **RLS enabled** on all tables
- `anon` → read-only (SELECT)
- `service_role` → full CRUD
- No wide-open policies — everything is role-scoped

## License

Hackathon prototype — not for production use.

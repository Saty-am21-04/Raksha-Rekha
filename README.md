# Raksha Rekha 🛡️

**SIH 2026 — Disaster-Relocation Planning Prototype**

A geospatial decision-support system for prioritizing habitation relocation from hazard-prone zones. Built on Supabase + PostGIS.

## Database Architecture

| Table | Purpose | Seed Rows |
|-------|---------|-----------|
| `rr_hazard_zones` | Polygonal hazard areas (landslide, flood, cloudburst, coastal erosion) | 15 |
| `rr_safe_sites` | Candidate relocation points with capacity & infrastructure scores | 10 |
| `rr_habitations` | Settlements/villages with population data | 40 |
| `rr_scores` | Computed priority scores linking habitations → safe sites | 0 (computed) |

### Region

All seed data is geo-located in **Wayanad, Kerala** (~11.6–11.72°N, 76.0–76.1°E), including 3 historical hazard zones modeling the **Wayanad Landslide 2024** (Mundakkai–Chooralmala corridor).

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
├── 00001_enable_postgis.sql        # PostGIS extension
├── 00002_create_tables.sql         # 4 rr_* tables
├── 00003_create_indexes.sql        # GIST + btree indexes
├── 00004_enable_rls.sql            # Row Level Security policies
└── 00005_seed_wayanad_data.sql     # Demo data (Wayanad region)
```

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

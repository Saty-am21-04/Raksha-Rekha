# RAKSHA-REKHA 🛡️

> **See risk earlier. Move people safer.**

A geospatial decision-support prototype for prioritising habitation relocation out
of hazard-prone terrain. It scores settlements against hazard zones, ranks them for
relocation, explains every score, and validates the whole approach by replaying the
real **2024 Wayanad (Mundakkai–Chooralmala) landslide**.

Built for **SIH 2026**. Prototype only — not an operational evacuation system.

---

## ⚠️ Read this first: the repo holds two parallel implementations

This is a monorepo containing **two independent stacks that do not share a
database**. Neither is wired to the other. Anyone picking this up should know which
one they're running.

| Track | Folders | Data store | Status |
|-------|---------|-----------|--------|
| **A — Express + MongoDB** | `server/`, `client/` | MongoDB (`MONGO_URI`) | Separate track |
| **B — Next.js + Supabase** | `dashboard/`, `supabase/` | Postgres + PostGIS (Supabase) | Documented in depth below |

Both implement scoring, backtesting and explainability, in different languages
against different databases. **This is an unresolved architectural fork, not a
layered design** — consolidating on one is probably the single highest-value
decision left before the demo.

Everything from "Track B" onward in this README describes only `dashboard/` +
`supabase/`, because that is the track whose behaviour is verified end-to-end
against the live project.

---

## Repository layout

| Path | What it is |
|------|-----------|
| `dashboard/` | **Track B frontend.** Next.js 16 App Router + TypeScript + Tailwind v4. The map dashboard. |
| `supabase/` | **Track B backend.** PostGIS migrations, seed data, and the `compute-scores` Edge Function. |
| `server/` | **Track A backend.** Express + Mongoose + Socket.IO. Services for scoring, priority, backtest, explainability, SITREP, notifications. Includes an IoT simulator. |
| `client/` | **Track A frontend.** Vite + React + MapLibre + Turf + Recharts, MVC-style controllers. |
| `Landing-page/` | Marketing site (TanStack Start, React 19, Tailwind v4). Independent of both tracks. |
| `docs/` | `PRD.md`, `FILE_STRUCTURE.md`, `EXECUTION_PLAYBOOK.md`. Start with `docs/README.md` for product framing. |
| `scripts/` | `init-mvc-structure.ps1` — PowerShell scaffolding helper for Track A. |

---

# Track B — Next.js + Supabase

## Architecture

```
┌──────────────────────────────────────────────┐
│  dashboard/  (Next.js 16, client-rendered)   │
│                                              │
│  Mapbox dark-v11 · priority list · panel     │
│  what-if slider · SDMA PDF export            │
└───────┬──────────────────────────┬───────────┘
        │ anon key (SELECT only)   │ POST /api/recompute
        │                          │ (server route, holds the secret)
        ▼                          ▼
┌───────────────────┐   ┌──────────────────────────────┐
│ PostgREST         │   │ compute-scores Edge Function │
│ rr_* tables, RLS  │   │ service-role key, writes     │
│ geom → GeoJSON    │   │ rr_scores for both datasets  │
└───────────────────┘   └──────────────────────────────┘
        └────────── Postgres 17 + PostGIS ─────────────┘
```

Two things worth internalising:

- **The dashboard cannot write.** It holds a publishable (anon) key which RLS
  restricts to `SELECT` on every `rr_*` table. All writes go through the Edge
  Function, which runs server-side with the service-role key.
- **The dashboard is client-rendered.** `DashboardShell` mounts with `ssr: false`.
  Every value comes from a client fetch, so server-rendering it produced only a
  skeleton while handing React a large tree that browser extensions corrupt before
  hydration. See [Known issues](#known-issues--gotchas).

## Data model

Four tables, all with RLS enabled (`anon` → SELECT, `service_role` → full CRUD).

| Table | Purpose | Live rows |
|-------|---------|-----------|
| `rr_hazard_zones` | Hazard polygons: landslide, flood, cloudburst, coastal erosion | **14** (12 synthetic + 2 historical) |
| `rr_safe_sites` | Candidate relocation points with capacity and infrastructure score | **13** |
| `rr_habitations` | Settlements with population | **42** |
| `rr_scores` | Computed priority scores, one row per (habitation, dataset) | **84** (42 × 2) |

Key columns:

- `rr_hazard_zones.source` — `'synthetic'` or `'historical'`. Drives Backtest Mode.
- `rr_hazard_zones.metadata` (`jsonb`) — observed event context for historical zones:
  rainfall totals, alert status, crown geometry, affected villages. `NULL` for
  synthetic zones, which have no measurements behind them.
- `rr_scores.source` + `UNIQUE (habitation_id, source)` — the upsert key. Without
  this unique index, "upsert" silently appends a row on every run.

**Geometry note:** this project's PostgREST serialises PostGIS `geometry` straight
to GeoJSON (with a legacy `crs` member Mapbox ignores), so no WKB decoding is
needed client-side.

### Historical dataset — real geography, not invented

The two `historical` zones use documented coordinates, so Backtest Mode is a
genuine validation rather than a re-skin of the synthetic set.

| Event | Intensity | Footprint |
|-------|-----------|-----------|
| **Wayanad Landslide 2024** | 9 | 8 km runout corridor from the Punjirimattom crown (76.13576°E, 11.46544°N) down the Punnapuzha channel through Mundakkai and Chooralmala |
| **Puthumala Landslide 2019** | 6 | Smaller zone ~2.2 km north — repeat failure on the same slope system five years earlier |

Intensity 9 is justified by measured rainfall stored in `metadata`: **372.6 mm/24 h,
586 mm/3 day, 809 mm/5 day**, with an orange alert issued.

Six habitations sit inside these footprints — Punjirimattom, Vellarimala Colony,
Mundakkai, Attamala, Chooralmala (2024) and Puthumala (2019) — plus three
relocation sites placed clear of the runout path.

The 2024 polygon traces the **runout corridor**, not the crown. The often-quoted
86,000 m² is the initiation scar and is preserved as `metadata.crown_area_sqm`; a
circular buffer around the crown would have wrongly shown the downstream villages
as safe.

## Scoring model

One definition, in `dashboard/lib/scoring-core.ts`. Stored normalised `0–1`; the UI
scales to `0–100` for display.

**`hazard_score`** — weights sum to 1, and `factor_breakdown` carries the three
weighted contributions, which sum exactly to `hazard_score`:

| Factor | Weight | Meaning |
|--------|--------|---------|
| `hazard_intensity` | **0.40** | Intensity of the strongest zone acting here, with distance falloff over a 2 km influence radius |
| `hazard_type` | **0.35** | Type severity: landslide 1.0, cloudburst 0.85, flood 0.7, coastal erosion 0.5 |
| `history` | **0.25** | Recorded historical failures within range, saturating at 3 |

The recurrence factor counts historical zones **regardless of the active dataset**,
so Puthumala 2019 raises Mundakkai's risk even while viewing the synthetic set.
That is the point of keeping the 2019 zone.

**`capacity_score`** — coverage ratio: the share of the population assigned to its
nearest safe site that the site can absorb, discounted by `infra_score`. Higher
means better served.

> **Deviation from the original spec, deliberate.** Expressing this as leftover
> headroom, `(capacity×infra − load) / (capacity×infra)`, collapses on real data:
> the 42 habitations total 22,853 people against 2,547 effective capacity, so
> demand outruns supply ~9:1, nearly every site is oversubscribed, and the measured
> result was **two distinct values across 42 rows** — which made `priority_rank` a
> pure function of hazard. The ratio keeps the same reading while degrading
> smoothly (now 12 distinct values, 0.0065 → 1.0).

**`priority_rank`** — `0.65 × hazard_score + 0.35 × (1 − capacity_score)`, ranked
descending. Ties break on population then name, so ordering is stable across runs.

### The model is defined once, and enforced

`dashboard/lib/scoring-core.ts` is dependency-free and alias-free so the identical
source runs in both Next.js and Deno. It is copied to
`supabase/functions/_shared/scoring-core.ts` by `npm run sync:scoring`.

Two copies exist because the Supabase CLI bundler only follows imports inside
`supabase/functions/`, while Next cannot import from outside its own root.
`npm run verify:scoring` **gates `npm run build`** and fails on drift, so a
persisted baseline and a live what-if simulation can never silently disagree.

> If you edit scoring, edit `dashboard/lib/scoring-core.ts` and run
> `npm run sync:scoring`. Never edit the `_shared/` copy — it is generated.

## Dashboard features

- **Live map** — Mapbox `dark-v11`. Hazard polygons coloured and opacity-ramped by
  intensity (dim amber → bright amber → red), safe sites as blue circles scaled by
  `capacity_max`, habitations as dots ramped by `priority_rank`.
- **Explainability panel** — click a habitation for its `rr_scores` row, a
  horizontal bar chart of `factor_breakdown`, nearest safe site with distance and
  capacity shortfall, and the zones acting on it split into *inside* vs *nearby*.
- **Priority list** — all habitations ranked, re-sortable by rank, name, population
  or hazard score. Selection syncs both ways with the map.
- **Backtest Mode** — switches `source` between synthetic and historical.
  Recomputes against the selected dataset rather than re-colouring static ranks, and
  banners *"Historical replay: Wayanad Landslide 2024"* (label read from
  `event_label`, not hardcoded).
- **What-if slider** — 0–100 track, 50 = baseline, spanning 0× to 2× hazard
  intensity. Recomputes client-side only using the shared model, re-renders zone
  opacity and the ranked list live, writes nothing. Badged **"Simulated — not
  saved"** and reset-able to the persisted baseline.
- **SDMA PDF export** — one A4 landscape page: map snapshot, top-10 table (name,
  population, hazard score, capacity score, nearest safe site), and the active
  dataset. A simulated export gains a `-simulated` filename suffix and an on-page
  warning.
- **Recompute Scores** — triggers the Edge Function and reloads persisted scores.

Theme: `#0a0a0a`/`#111111` shell, `#1a1a1a` panels, single amber accent `#d99b3f`,
text `#e8e8e8` / `#8a8a8a`. Responsive — below `md` the map and list swap behind
tabs and the panel becomes a bottom sheet.

---

## Setup

### Prerequisites

- **Node.js 20+** (developed on 26) and npm
- **Supabase CLI** — `brew install supabase/tap/supabase`
- A **Mapbox** account for a `pk.*` token
- Docker is **not** required for `db push` or `functions deploy`. It *is* required
  for `supabase start`, `db reset` and `db dump`.

### 1. Environment

```bash
cd dashboard
cp .env.example .env.local
```

Fill in `.env.local` (gitignored):

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | public | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Publishable key. Read-only under RLS. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | public | `pk.*` tokens are designed for client use. |
| `RR_COMPUTE_SECRET` | **server-only** | Guards the Edge Function. Deliberately **not** `NEXT_PUBLIC_`. Read by `app/api/recompute/route.ts`. |

> **No service-role key belongs in this app.** The dashboard is read-only and the
> Edge Function receives `SUPABASE_SERVICE_ROLE_KEY` automatically from the Supabase
> runtime. If you find a service key in `dashboard/`, remove it.

### 2. Database

```bash
supabase link --project-ref <your-ref>
supabase db push          # applies all 8 migrations
```

### 3. Edge Function

```bash
supabase functions deploy compute-scores

# Recommended: require a shared secret (see the security note below)
supabase secrets set RR_COMPUTE_SECRET="$(openssl rand -hex 32)"
# then put the SAME value in dashboard/.env.local
```

### 4. Run

```bash
cd dashboard
npm install
npm run dev            # http://localhost:3000 → redirects to /dashboard
```

On first load, if `rr_scores` is empty for the active dataset the dashboard
triggers a recompute automatically and holds its loading state until rows arrive.

---

## Supabase workflow

### Migrations

| File | What it does |
|------|--------------|
| `…001000_enable_postgis.sql` | PostGIS **into the `extensions` schema** |
| `…001100_create_tables.sql` | The four `rr_*` tables |
| `…001200_create_indexes.sql` | GIST spatial + btree indexes |
| `…001300_enable_rls.sql` | RLS policies, role-scoped |
| `…001400_seed_wayanad_data.sql` | 15 zones (12 synthetic + 3 *placeholder* historical), 10 safe sites, 41 habitations |
| `…002000_add_hazard_zone_metadata.sql` | `metadata jsonb` + GIN index |
| `…002100_seed_historical_wayanad_events.sql` | Real 2024 + 2019 geography. Deletes `001400`'s 3 placeholder historical zones (they sat ~19 km from the real crown), relocates 5 corridor villages onto true coordinates instead of duplicating names, adds Punjirimattom and 3 safe sites → net **14 / 13 / 42** |
| `…002200_rr_scores_source_and_upsert_key.sql` | `rr_scores.source`, `NOT NULL habitation_id`, `UNIQUE (habitation_id, source)` |

Migration `002100` ends in a `DO` block that **asserts its own geometry** — ring
validity, non-overlap of the two events, ~8 km runout, corridor elongation, all six
villages inside their footprints, all new safe sites clear. A bad polygon aborts
the migration instead of quietly rendering wrong.

### ⚠️ PostGIS must be schema-qualified in migrations

PostGIS lives in the **`extensions`** schema, and the `db push` connection's
`search_path` does not include it. An unqualified reference fails with:

```
ERROR: type "geometry" does not exist (SQLSTATE 42704)
```

So in any new migration write `extensions.ST_Intersects(...)`,
`extensions.geometry`, `extensions.geography`, and so on.

This bites only migrations. `supabase/config.toml` sets
`extra_search_path = ["public", "extensions"]`, which applies to **PostgREST API
requests** — which is why the dashboard's queries resolve unqualified PostGIS
happily while `db push` does not.

Migrations `001100` and `001400` predate this rule and use unqualified PostGIS.
They are already applied so they never re-run, but **a fresh `supabase db reset`
will fail on `001100`.** Qualify them before standing the project up in a new
environment.

### Invoking compute-scores

```bash
# Both datasets
curl -X POST "https://<ref>.supabase.co/functions/v1/compute-scores" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-rr-compute-secret: $RR_COMPUTE_SECRET" \
  -H "Content-Type: application/json" -d '{}'

# One dataset
… -d '{"source":"historical"}'
```

Suitable for cron or a one-off script. It upserts on
`(habitation_id, source)`, so it is idempotent — repeated runs overwrite in place
and `rr_scores` stays at 84 rows.

---

## Useful commands

```bash
# dashboard/
npm run dev              # dev server
npm run build            # runs verify:scoring, then next build
npm run lint
npm run sync:scoring     # regenerate the Deno copy of the scoring model
npm run verify:scoring   # fail if the two copies have drifted

# repo root
supabase migration list --linked            # local vs remote migration state
supabase db push --dry-run --linked         # preview pending migrations
supabase functions deploy compute-scores
supabase secrets list --project-ref <ref>
```

Quick data sanity check without a SQL client:

```bash
curl -s "$URL/rest/v1/rr_scores?select=source" -H "apikey: $ANON_KEY" \
  | python3 -c "import json,sys,collections;print(collections.Counter(r['source'] for r in json.load(sys.stdin)))"
# → Counter({'synthetic': 42, 'historical': 42})
```

---

## Security

- **RLS on every table.** `anon` → SELECT only. `service_role` → full CRUD. No
  wide-open policies.
- **No service-role key in the frontend.** Writes happen only inside the Edge
  Function, which the Supabase runtime supplies with the key.
- **`RR_COMPUTE_SECRET` stays server-side.** A browser cannot hold a shared secret,
  so `app/api/recompute/route.ts` proxies the call and attaches the header. The
  secret is never in the client bundle.

### 🔴 Known exposure

**`/api/recompute` is unauthenticated.** Anyone who can reach the deployed app can
trigger a recompute. The proxy stops the Edge Function being invoked directly by
anyone who reads the JS bundle, but it does **not** remove the denial-of-service
surface.

Closing it properly needs either app-level auth on that route, or removing the
button and driving recompute from cron only. Acceptable for a hackathon demo;
**not acceptable if this is ever deployed publicly.**

---

## Known issues & gotchas

| Issue | Detail |
|-------|--------|
| **Hydration warning may persist** | Browser extensions (e.g. `bis_skin_checked` from Bitdefender-family extensions) stamp attributes before React hydrates. The dashboard subtree is no longer server-rendered, cutting this from ~26 elements to at most 1 — Next's internal `<div hidden="">` metadata wrapper, which has no supported way to receive `suppressHydrationWarning`. Only disabling the extension fully removes it. |
| **Extension errors in the console** | `ExtensionNoiseFilter` marks errors whose stack is *entirely* within an extension origin as handled. It cannot swallow app errors (a single app frame disables suppression), but Next's dev overlay may still display them depending on listener order. |
| **`rr_hazard_zones.metadata` is unsurfaced** | The rainfall figures justifying intensity 9 are fetched and typed but not shown in any UI yet. Obvious next win: surface them in the hazard hover popup and panel. |
| **`db reset` will fail** | Migrations `001100`/`001400` use unqualified PostGIS. See the warning above. |
| **What-if slider saturates** | Above ~1.5× the effect plateaus, because intensity is clamped to 1–10 to match the schema `CHECK`. Correct, but can look like the slider stopped working. |
| **No automated test suite** | Track B has no test runner. Correctness has been verified with throwaway harnesses and live-data checks, not committed tests. Track A has some (`server/`'s `npm test`). |
| **Two stacks, one repo** | See the note at the top. `client/`+`server/` (MongoDB) and `dashboard/`+`supabase/` (Postgres) are unconnected. |

---

## License

Hackathon prototype for SIH 2026. Not for production use. Outputs are
decision-support only and must not be treated as operational evacuation orders.

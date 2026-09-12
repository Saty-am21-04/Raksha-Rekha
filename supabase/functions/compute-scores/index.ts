/**
 * compute-scores — persists relocation priority scores into rr_scores.
 *
 * Reads rr_hazard_zones, rr_safe_sites and rr_habitations, scores every
 * habitation against BOTH hazard datasets ('synthetic' and 'historical'), and
 * upserts one rr_scores row per (habitation_id, source).
 *
 * Reads:  rr_hazard_zones, rr_safe_sites, rr_habitations
 * Writes: rr_scores only.
 *
 * The scoring model is not implemented here — it comes from
 * ../_shared/scoring-core.ts, a generated copy of dashboard/lib/scoring-core.ts.
 * The dashboard's what-if slider imports the same model, so a persisted
 * baseline and a live simulation always agree. `npm run verify:scoring` in the
 * dashboard fails if the copy drifts.
 *
 * Invoke:
 *   POST /functions/v1/compute-scores
 *   body (optional): { "source": "synthetic" | "historical" }   // default: both
 *
 * ── SECURITY ──
 * This endpoint writes to the database using the service-role key. Supabase's
 * default JWT check is satisfied by the *publishable* anon key, which is public
 * by design, so without a second factor anyone could trigger a recompute. Set
 * the RR_COMPUTE_SECRET secret to require an x-rr-compute-secret header:
 *
 *   supabase secrets set RR_COMPUTE_SECRET="$(openssl rand -hex 32)"
 *
 * When the secret is unset the function still runs, so the demo is never
 * blocked, but it reports "unprotected" in the response so the gap is visible
 * rather than silent.
 */

import { createClient } from "npm:@supabase/supabase-js@2.58.0";

import {
  scoreAll,
  type CoreHabitation,
  type CoreSite,
  type CoreZone,
} from "../_shared/scoring-core.ts";

type DataSource = "synthetic" | "historical";
const SOURCES: DataSource[] = ["synthetic", "historical"];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-rr-compute-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Browser preflight for supabase.functions.invoke().
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  const requiredSecret = Deno.env.get("RR_COMPUTE_SECRET");
  if (requiredSecret) {
    const provided = req.headers.get("x-rr-compute-secret");
    if (provided !== requiredSecret) {
      return json({ error: "Invalid or missing x-rr-compute-secret." }, 401);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(
      { error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available." },
      500,
    );
  }

  // Only requested dataset(s); defaults to both.
  let requested: DataSource[] = SOURCES;
  try {
    const raw = await req.text();
    if (raw.trim()) {
      const body = JSON.parse(raw) as { source?: string };
      if (body.source) {
        if (!SOURCES.includes(body.source as DataSource)) {
          return json(
            { error: `source must be one of ${SOURCES.join(", ")}.` },
            400,
          );
        }
        requested = [body.source as DataSource];
      }
    }
  } catch {
    return json({ error: "Body must be valid JSON." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const startedAt = Date.now();

  // ---------- read inputs ----------
  const [zonesRes, sitesRes, habitationsRes] = await Promise.all([
    supabase
      .from("rr_hazard_zones")
      .select("id, geom, hazard_type, intensity, source"),
    supabase.from("rr_safe_sites").select("id, geom, capacity_max, infra_score"),
    supabase.from("rr_habitations").select("id, geom, name, population"),
  ]);

  const readError = zonesRes.error ?? sitesRes.error ?? habitationsRes.error;
  if (readError) {
    return json({ error: `Read failed: ${readError.message}` }, 500);
  }

  const zones = (zonesRes.data ?? []) as unknown as CoreZone[];
  const sites = (sitesRes.data ?? []) as unknown as CoreSite[];
  const habitations = (habitationsRes.data ?? []) as unknown as CoreHabitation[];

  if (habitations.length === 0) {
    return json({ error: "No habitations to score." }, 422);
  }
  if (sites.length === 0) {
    return json({ error: "No safe sites; capacity scores would be zero." }, 422);
  }

  // Recurrence is computed against every historical zone regardless of the
  // dataset being scored — see computeHazard in the shared model.
  const historicalZones = zones.filter((z) => z.source === "historical");

  // ---------- score and persist, per dataset ----------
  const results: Record<string, unknown> = {};

  for (const source of requested) {
    const activeZones = zones.filter((z) => z.source === source);

    const scored = scoreAll(habitations, activeZones, historicalZones, sites, 1);

    const rows = scored.map(({ score }) => ({
      habitation_id: score.habitation_id,
      hazard_score: score.hazard_score,
      capacity_score: score.capacity_score,
      priority_rank: score.priority_rank,
      factor_breakdown: score.factor_breakdown,
      nearest_safe_site_id: score.nearest_safe_site_id,
      source,
      computed_at: new Date().toISOString(),
    }));

    // Conflict target is the unique index added in migration 20260913002200.
    // Without it this would append duplicates on every run.
    const { error: writeError, count } = await supabase
      .from("rr_scores")
      .upsert(rows, { onConflict: "habitation_id,source", count: "exact" });

    if (writeError) {
      return json(
        {
          error: `Upsert failed for source="${source}": ${writeError.message}`,
          hint:
            "If this mentions a missing unique/exclusion constraint, migration 20260913002200 has not been applied.",
        },
        500,
      );
    }

    const top = scored.slice(0, 5).map(({ score, detail }) => {
      const h = habitations.find((x) => x.id === score.habitation_id);
      return {
        rank: score.priority_rank,
        name: h?.name ?? score.habitation_id,
        hazard_score: score.hazard_score,
        capacity_score: score.capacity_score,
        nearby_historical_zones: detail.nearbyHistoricalCount,
      };
    });

    results[source] = {
      zones_used: activeZones.length,
      rows_written: count ?? rows.length,
      top_5: top,
    };
  }

  return json({
    ok: true,
    duration_ms: Date.now() - startedAt,
    habitations: habitations.length,
    safe_sites: sites.length,
    historical_zones_considered: historicalZones.length,
    protection: requiredSecret ? "x-rr-compute-secret required" : "unprotected",
    results,
  });
});

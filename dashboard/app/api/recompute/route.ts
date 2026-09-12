import { NextResponse } from "next/server";

/**
 * Server-side proxy to the compute-scores Edge Function.
 *
 * Why this exists: the Edge Function is guarded by RR_COMPUTE_SECRET, and a
 * browser cannot hold a shared secret — anything shipped to the client is
 * public. Calling the function straight from the dashboard therefore returned
 * 401. This route runs on the server, attaches the secret, and relays the
 * function's real status and body back so the UI can show the actual error
 * rather than "non-2xx status code".
 *
 * RESIDUAL EXPOSURE, stated plainly: this route is itself unauthenticated, so
 * anyone who can reach the deployed app can still trigger a recompute. What it
 * buys is that the secret stays server-side and the Supabase function can no
 * longer be hit directly by anyone who reads the JS bundle. Closing the gap
 * properly needs app-level auth (or dropping the button and running recompute
 * from cron only) — see the note in supabase/functions/compute-scores/index.ts.
 */

export const runtime = "nodejs";
/** Never cache a mutation. */
export const dynamic = "force-dynamic";

interface RecomputeBody {
  source?: "synthetic" | "historical";
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.RR_COMPUTE_SECRET;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      {
        error:
          "Server is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  let body: RecomputeBody = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as RecomputeBody;
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  };

  // Only sent when configured, so the function works whether or not the
  // project has the secret set.
  if (secret) headers["x-rr-compute-secret"] = secret;

  const target = `${supabaseUrl}/functions/v1/compute-scores`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(body.source ? { source: body.source } : {}),
    });
  } catch (err) {
    console.error("[recompute] fetch to Edge Function failed", {
      target,
      error: err,
    });
    return NextResponse.json(
      {
        error: `Could not reach the compute-scores function: ${
          err instanceof Error ? err.message : "unknown network error"
        }`,
      },
      { status: 502 },
    );
  }

  // Relay the body verbatim — its `error` field is the real diagnosis.
  const text = await upstream.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text.slice(0, 1000) || upstream.statusText };
  }

  if (!upstream.ok) {
    console.error("[recompute] Edge Function returned an error", {
      status: upstream.status,
      secretConfigured: Boolean(secret),
      payload,
    });
  }

  return NextResponse.json(payload, { status: upstream.status });
}

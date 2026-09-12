/**
 * Environment access with fail-fast validation.
 *
 * Every value here is intentionally public (NEXT_PUBLIC_*): the Supabase
 * publishable key is read-only under the rr_* RLS policies, and Mapbox pk.*
 * tokens are designed for client-side use. No service_role key is read here.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  mapboxToken: required(
    "NEXT_PUBLIC_MAPBOX_TOKEN",
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  ),
} as const;

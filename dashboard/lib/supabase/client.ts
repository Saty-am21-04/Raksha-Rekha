import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Shared Supabase client for the RAKSHA-REKHA dashboard.
 *
 * Read-only by design: the publishable key only carries the `anon` role, which
 * the rr_* RLS policies restrict to SELECT. Auth persistence is disabled since
 * the dashboard has no sign-in flow.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

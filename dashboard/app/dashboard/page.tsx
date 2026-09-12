import { supabase } from "@/lib/supabase/client";

const TABLES = [
  "rr_hazard_zones",
  "rr_safe_sites",
  "rr_habitations",
  "rr_scores",
] as const;

async function tableCounts() {
  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });
      return { table, count: count ?? 0, error: error?.message ?? null };
    }),
  );
  return results;
}

export default async function DashboardPage() {
  const counts = await tableCounts();

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          RAKSHA-<span className="text-amber">REKHA</span>
        </h1>
        <p className="text-muted mt-1 text-sm">
          Supabase connection check — Wayanad, Kerala
        </p>
      </header>

      <ul className="border-subtle bg-panel divide-subtle max-w-md divide-y rounded-lg border">
        {counts.map(({ table, count, error }) => (
          <li
            key={table}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <code className="text-muted font-mono text-xs">{table}</code>
            {error ? (
              <span className="text-xs text-red-400">{error}</span>
            ) : (
              <span className="text-amber font-mono">{count} rows</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

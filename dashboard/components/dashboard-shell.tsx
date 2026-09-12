"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { HabitationPanel } from "@/components/habitation-panel";
import { MapLegend } from "@/components/map-legend";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import type { DataSource } from "@/lib/supabase/types";

// mapbox-gl touches window at construction time, so the map never renders on
// the server.
const HazardMap = dynamic(
  () => import("@/components/hazard-map").then((m) => m.HazardMap),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted flex h-full w-full items-center justify-center text-sm">
        Loading map…
      </div>
    ),
  },
);

export function DashboardShell() {
  const [source] = useState<DataSource>("synthetic");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const view = useDashboardData(source);

  const selected = useMemo(
    () => view.ranked.find((r) => r.id === selectedId) ?? null,
    [view.ranked, selectedId],
  );

  const clearSelection = useCallback(() => setSelectedId(null), []);

  // Escape closes the panel.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, clearSelection]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-subtle bg-bg-raised flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-tight">
            RAKSHA-<span className="text-amber">REKHA</span>
          </h1>
          <p className="text-muted text-xs">Wayanad, Kerala</p>
        </div>

        <dl className="text-muted flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <dt>Hazard zones</dt>
            <dd className="text-fg font-mono">{view.hazardZones.length}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>Safe sites</dt>
            <dd className="text-fg font-mono">{view.safeSites.length}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>Habitations</dt>
            <dd className="text-fg font-mono">{view.ranked.length}</dd>
          </div>
        </dl>
      </header>

      {view.status === "error" ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="border-subtle bg-panel max-w-md rounded-lg border p-4 text-sm text-red-400">
            {view.error}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1">
            <HazardMap
              hazardZones={view.hazardZones}
              safeSites={view.safeSites}
              ranked={view.ranked}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />

            <div className="absolute bottom-8 left-3 w-52">
              <MapLegend total={view.ranked.length} />
            </div>

            {view.status === "loading" && (
              <div className="border-subtle bg-panel/95 text-muted absolute left-1/2 top-3 -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs backdrop-blur">
                Loading Wayanad dataset…
              </div>
            )}
          </main>

          {selected && (
            <aside className="border-subtle bg-panel w-80 shrink-0 border-l">
              <HabitationPanel
                habitation={selected}
                total={view.ranked.length}
                usingPersistedScores={view.usingPersistedScores}
                onClose={clearSelection}
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

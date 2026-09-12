"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BacktestBanner } from "@/components/backtest-banner";
import { BacktestToggle } from "@/components/backtest-toggle";
import { HabitationPanel } from "@/components/habitation-panel";
import { MapLegend } from "@/components/map-legend";
import { PriorityList } from "@/components/priority-list";
import type { SortKey } from "@/components/priority-list";
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

/** Below md the map and list share the viewport, one at a time. */
type MobileTab = "map" | "list";

export function DashboardShell() {
  const [source, setSource] = useState<DataSource>("synthetic");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");

  const view = useDashboardData(source);

  const selected = useMemo(
    () => view.ranked.find((r) => r.id === selectedId) ?? null,
    [view.ranked, selectedId],
  );

  const clearSelection = useCallback(() => setSelectedId(null), []);

  /**
   * Selecting from the list also reveals the map on narrow screens, so the
   * highlight it triggers is actually visible. On md+ the tab is inert.
   */
  const selectFromList = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setMobileTab("map");
  }, []);

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
    /* suppressHydrationWarning: browser extensions stamp bis_skin_checked onto
       layout divs before React hydrates. Not an app bug — see the note in
       app/layout.tsx. Covers this element's own attributes only. */
    <div suppressHydrationWarning className="flex h-dvh flex-col">
      <header className="border-subtle bg-bg-raised flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
          <h1 className="shrink-0 text-sm font-semibold tracking-tight">
            RAKSHA-<span className="text-amber">REKHA</span>
          </h1>
          <p className="text-muted hidden truncate text-xs sm:block">
            Wayanad, Kerala
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 lg:gap-5">
          {/* Counts are supporting detail; they yield first on narrow screens. */}
          <dl className="text-muted hidden items-center gap-4 text-xs lg:flex">
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

          <div className="border-subtle lg:border-l lg:pl-5">
            <BacktestToggle
              source={source}
              counts={view.sourceCounts}
              onChange={setSource}
            />
          </div>
        </div>
      </header>

      {source === "historical" && (
        <BacktestBanner
          eventLabel={view.eventLabel}
          zoneCount={view.hazardZones.length}
          onExit={() => setSource("synthetic")}
        />
      )}

      {view.status === "error" ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="border-subtle bg-panel max-w-md rounded-lg border p-4 text-sm text-red-400">
            {view.error}
          </p>
        </div>
      ) : (
        <>
          {/* Map/List switcher, mobile only */}
          <div
            role="tablist"
            aria-label="Dashboard view"
            className="border-subtle bg-bg-raised flex shrink-0 gap-1 border-b px-3 py-1.5 md:hidden"
          >
            {(["map", "list"] as MobileTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mobileTab === tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 rounded px-3 py-1.5 text-xs capitalize transition-colors ${
                  mobileTab === tab
                    ? "bg-amber/15 text-amber"
                    : "text-muted hover:bg-panel-hover"
                }`}
              >
                {tab === "list" ? `Priority list (${view.ranked.length})` : "Map"}
              </button>
            ))}
          </div>

          <div className="relative flex min-h-0 flex-1">
            <aside
              className={`border-subtle bg-panel w-full shrink-0 border-r md:w-64 lg:w-72 ${
                mobileTab === "list" ? "flex" : "hidden"
              } md:flex`}
            >
              <PriorityList
                ranked={view.ranked}
                selectedId={selectedId}
                sortKey={sortKey}
                onSortChange={setSortKey}
                onSelect={selectFromList}
              />
            </aside>

            <main
              className={`relative min-w-0 flex-1 ${
                mobileTab === "map" ? "block" : "hidden"
              } md:block`}
            >
              <HazardMap
                hazardZones={view.hazardZones}
                safeSites={view.safeSites}
                ranked={view.ranked}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />

              {/* Legend would crowd a phone viewport, so it starts at md. */}
              <div className="absolute bottom-8 left-3 hidden w-52 md:block">
                <MapLegend total={view.ranked.length} />
              </div>

              {view.status === "loading" && (
                <div className="border-subtle bg-panel/95 text-muted absolute left-1/2 top-3 -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs backdrop-blur">
                  Loading Wayanad dataset…
                </div>
              )}
            </main>

            {selected && (
              /* Bottom sheet on phones, right rail from md up. */
              <aside
                className="border-subtle bg-panel fixed inset-x-0 bottom-0 z-30 flex max-h-[68dvh] flex-col rounded-t-xl border-t shadow-[0_-8px_32px_rgba(0,0,0,0.6)] md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none lg:w-96"
              >
                <HabitationPanel
                  habitation={selected}
                  total={view.ranked.length}
                  usingPersistedScores={view.usingPersistedScores}
                  onClose={clearSelection}
                />
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}

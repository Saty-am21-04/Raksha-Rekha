"use client";

import { useEffect, useMemo, useState } from "react";

import { eventLabelFor, fetchDashboardData, zonesForSource } from "@/lib/data";
import type { DashboardData } from "@/lib/data";
import { mergePersistedScores, scoreHabitations } from "@/lib/scoring";
import type { ScoredHabitation } from "@/lib/scoring";
import type { DataSource, HazardZone } from "@/lib/supabase/types";

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: DashboardData; error: null }
  | { status: "error"; data: null; error: string };

export interface DashboardView {
  status: LoadState["status"];
  error: string | null;
  /** Hazard zones for the active source only. */
  hazardZones: HazardZone[];
  /** Habitations scored against the active source, ordered by priority_rank. */
  ranked: ScoredHabitation[];
  safeSites: DashboardData["safeSites"];
  /** e.g. "Wayanad Landslide 2024" when the active source has a label. */
  eventLabel: string | null;
  /** True once real rr_scores rows exist and are being used. */
  usingPersistedScores: boolean;
  /** Zone counts per source, for the toggle's affordance. */
  sourceCounts: Record<DataSource, number>;
}

/**
 * Loads the rr_* tables once, then derives the scored view for `source`.
 *
 * Switching source recomputes from the in-memory dataset — no refetch — so the
 * Backtest Mode toggle is instant.
 */
export function useDashboardData(source: DataSource): DashboardView {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetchDashboardData()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const empty: DashboardView = {
      status: state.status,
      error: state.error,
      hazardZones: [],
      ranked: [],
      safeSites: [],
      eventLabel: null,
      usingPersistedScores: false,
      sourceCounts: { synthetic: 0, historical: 0 },
    };

    if (state.status !== "ready") return empty;

    const { hazardZones, safeSites, habitations, persistedScores } = state.data;
    const activeZones = zonesForSource(hazardZones, source);

    const computed = scoreHabitations(habitations, activeZones, safeSites);
    const { rows, usedPersisted } = mergePersistedScores(
      computed,
      persistedScores,
    );

    return {
      status: state.status,
      error: null,
      hazardZones: activeZones,
      ranked: rows,
      safeSites,
      eventLabel: eventLabelFor(activeZones),
      usingPersistedScores: usedPersisted,
      sourceCounts: {
        synthetic: zonesForSource(hazardZones, "synthetic").length,
        historical: zonesForSource(hazardZones, "historical").length,
      },
    };
  }, [state, source]);
}

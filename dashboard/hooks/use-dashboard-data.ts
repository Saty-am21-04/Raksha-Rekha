"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  eventLabelFor,
  fetchBaseData,
  fetchScores,
  historicalZones as pickHistorical,
  recomputeScores,
  zonesForSource,
} from "@/lib/data";
import type { BaseData } from "@/lib/data";
import { fromPersistedScores, simulateScores } from "@/lib/scoring";
import type { ScoredHabitation } from "@/lib/scoring";
import type { DataSource, HazardZone, SafeSite } from "@/lib/supabase/types";
import type { Score } from "@/lib/supabase/types";

/** Slider default. 1 = the persisted baseline. */
export const BASELINE_MULTIPLIER = 1;

export interface DashboardView {
  status: "loading" | "ready" | "error";
  error: string | null;
  /** Hazard zones for the active source only. */
  hazardZones: HazardZone[];
  safeSites: SafeSite[];
  /** Habitations ordered by priority_rank. */
  ranked: ScoredHabitation[];
  eventLabel: string | null;
  sourceCounts: Record<DataSource, number>;
  /** True when ranked comes from rr_scores rather than a live simulation. */
  usingPersistedScores: boolean;
  /** True while the slider is off its default. */
  isSimulating: boolean;
  isRecomputing: boolean;
  /** When the persisted rows for this dataset were written. */
  lastComputedAt: string | null;
  /** How many persisted rows exist for the active dataset. */
  persistedCount: number;
  recompute: () => void;
}

/**
 * Loads the rr_* tables once, then reads persisted rr_scores for the active
 * dataset.
 *
 * Baseline scores are never computed in the browser — they are read from
 * rr_scores, which the compute-scores Edge Function owns. If a dataset has no
 * rows yet, a recompute is triggered automatically on first sight of it and the
 * caller stays in its loading state until rows arrive.
 *
 * The one exception is the what-if slider: when `intensityMultiplier` leaves its
 * default the same shared model runs client-side for instant feedback, and
 * nothing is written.
 */
export function useDashboardData(
  source: DataSource,
  intensityMultiplier: number = BASELINE_MULTIPLIER,
): DashboardView {
  const [base, setBase] = useState<BaseData | null>(null);
  const [scores, setScores] = useState<Record<string, Score[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);

  /** Datasets we've already auto-triggered, so an empty result can't loop. */
  const autoTriggered = useRef<Set<string>>(new Set());
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  /* ---------- base tables, once ---------- */
  useEffect(() => {
    fetchBaseData()
      .then((data) => {
        if (!cancelled.current) setBase(data);
      })
      .catch((err: unknown) => {
        if (!cancelled.current) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      });
  }, []);

  const loadScores = useCallback(async (which: DataSource) => {
    const rows = await fetchScores(which);
    if (!cancelled.current) {
      setScores((prev) => ({ ...prev, [which]: rows }));
    }
    return rows;
  }, []);

  const runRecompute = useCallback(
    async (which: DataSource) => {
      setIsRecomputing(true);
      setError(null);
      try {
        await recomputeScores(which);
        await loadScores(which);
      } catch (err: unknown) {
        if (!cancelled.current) {
          setError(err instanceof Error ? err.message : "Recompute failed");
        }
      } finally {
        if (!cancelled.current) setIsRecomputing(false);
      }
    },
    [loadScores],
  );

  /* ---------- scores for the active dataset ---------- */
  useEffect(() => {
    if (scores[source] !== undefined) return;

    loadScores(source)
      .then((rows) => {
        // Empty table for this dataset: compute it once, rather than silently
        // showing every habitation at rank zero.
        if (rows.length === 0 && !autoTriggered.current.has(source)) {
          autoTriggered.current.add(source);
          void runRecompute(source);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled.current) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      });
  }, [source, scores, loadScores, runRecompute]);

  const recompute = useCallback(() => {
    void runRecompute(source);
  }, [runRecompute, source]);

  return useMemo(() => {
    const isSimulating = intensityMultiplier !== BASELINE_MULTIPLIER;

    const empty: DashboardView = {
      status: error ? "error" : "loading",
      error,
      hazardZones: [],
      safeSites: [],
      ranked: [],
      eventLabel: null,
      sourceCounts: { synthetic: 0, historical: 0 },
      usingPersistedScores: !isSimulating,
      isSimulating,
      isRecomputing,
      lastComputedAt: null,
      persistedCount: 0,
      recompute,
    };

    if (error) return empty;
    if (!base) return empty;

    const activeZones = zonesForSource(base.hazardZones, source);
    const histZones = pickHistorical(base.hazardZones);
    const persisted = scores[source];

    const sourceCounts: Record<DataSource, number> = {
      synthetic: zonesForSource(base.hazardZones, "synthetic").length,
      historical: zonesForSource(base.hazardZones, "historical").length,
    };

    const shared = {
      hazardZones: activeZones,
      safeSites: base.safeSites,
      eventLabel: eventLabelFor(activeZones),
      sourceCounts,
      isSimulating,
      isRecomputing,
      recompute,
    };

    if (isSimulating) {
      // Slider is engaged: run the shared model in the browser, write nothing.
      return {
        ...shared,
        status: "ready" as const,
        error: null,
        ranked: simulateScores(
          base.habitations,
          activeZones,
          histZones,
          base.safeSites,
          intensityMultiplier,
          source,
        ),
        usingPersistedScores: false,
        lastComputedAt: null,
        persistedCount: persisted?.length ?? 0,
      };
    }

    // Baseline path: still loading until this dataset has persisted rows.
    if (persisted === undefined || (persisted.length === 0 && isRecomputing)) {
      return { ...empty, ...shared, status: "loading" as const, error: null };
    }

    return {
      ...shared,
      status: "ready" as const,
      error: null,
      ranked: fromPersistedScores(
        base.habitations,
        activeZones,
        histZones,
        base.safeSites,
        persisted,
      ),
      usingPersistedScores: true,
      lastComputedAt: persisted[0]?.computed_at ?? null,
      persistedCount: persisted.length,
    };
  }, [
    base,
    scores,
    source,
    error,
    isRecomputing,
    intensityMultiplier,
    recompute,
  ]);
}

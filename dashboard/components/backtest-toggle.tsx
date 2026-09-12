"use client";

import type { DataSource } from "@/lib/supabase/types";

interface BacktestToggleProps {
  source: DataSource;
  /** Zone counts per source, surfaced so the cost of switching is visible. */
  counts: Record<DataSource, number>;
  onChange: (source: DataSource) => void;
}

/**
 * Switches the active hazard dataset between the synthetic planning set and
 * the historical replay set.
 *
 * Implemented as a real switch (role + aria-checked) rather than two buttons,
 * since it toggles one binary piece of state.
 */
export function BacktestToggle({
  source,
  counts,
  onChange,
}: BacktestToggleProps) {
  const active = source === "historical";

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] font-medium">Backtest Mode</span>
        <span className="text-muted font-mono text-[10px]">
          {active
            ? `historical · ${counts.historical} zones`
            : `synthetic · ${counts.synthetic} zones`}
        </span>
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label="Backtest Mode — replay a historical disaster dataset"
        onClick={() => onChange(active ? "synthetic" : "historical")}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          active
            ? "bg-amber/30 border-amber"
            : "bg-subtle border-subtle-strong"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${
            active ? "left-[18px] bg-amber" : "left-[2px] bg-muted"
          }`}
        />
      </button>
    </div>
  );
}

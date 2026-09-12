"use client";

interface BacktestBannerProps {
  /** Event name from rr_hazard_zones.event_label, e.g. "Wayanad Landslide 2024". */
  eventLabel: string | null;
  zoneCount: number;
  onExit: () => void;
}

/**
 * Persistent notice that the map is showing a historical replay rather than the
 * synthetic planning dataset, so scores on screen are never mistaken for the
 * forward-looking set.
 */
export function BacktestBanner({
  eventLabel,
  zoneCount,
  onExit,
}: BacktestBannerProps) {
  return (
    <div
      role="status"
      className="border-amber/40 bg-amber/10 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2"
    >
      <p className="text-amber flex min-w-0 items-center gap-2 text-xs">
        <span
          aria-hidden
          className="bg-amber h-1.5 w-1.5 shrink-0 rounded-full"
        />
        <span className="truncate">
          <span className="font-medium">
            Historical replay: {eventLabel ?? "historical dataset"}
          </span>
          <span className="text-amber/70">
            {" "}
            — scores recomputed against {zoneCount} recorded hazard{" "}
            {zoneCount === 1 ? "zone" : "zones"}
          </span>
        </span>
      </p>

      <button
        type="button"
        onClick={onExit}
        className="text-amber/80 hover:bg-amber/15 hover:text-amber shrink-0 rounded px-2 py-0.5 text-[11px] transition-colors"
      >
        Exit replay
      </button>
    </div>
  );
}

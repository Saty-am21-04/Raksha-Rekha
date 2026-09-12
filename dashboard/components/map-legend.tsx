"use client";

import { hazardColor, priorityColor, safeSiteRadius } from "@/lib/theme";

const HAZARD_TICKS = [1, 3, 5, 7, 9, 10];
const CAPACITY_SAMPLES = [50, 200, 500];
const PRIORITY_SWATCHES = 5;

/**
 * Rank values to draw swatches for, spread evenly across the live dataset.
 *
 * These used to be hardcoded to [1, 8, 18, 30, 41], which silently went stale
 * the moment the habitation count changed: the caption promises "rank 1 → last"
 * but 41 stopped being the last rank when Punjirimattom brought the count to 42,
 * and on any smaller dataset every high sample clamped to the same dark end of
 * the ramp. Deriving them keeps the swatches honest at any size.
 */
function sampleRanks(total: number): number[] {
  if (total < 1) return [];
  if (total <= PRIORITY_SWATCHES) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  return Array.from({ length: PRIORITY_SWATCHES }, (_, i) =>
    Math.round(1 + (i * (total - 1)) / (PRIORITY_SWATCHES - 1)),
  );
}

/** Key for the three map layers. `total` is the live ranked-habitation count. */
export function MapLegend({ total }: { total: number }) {
  const rankTotal = Math.max(total, 2);
  const ranks = sampleRanks(total);

  return (
    <div className="border-subtle bg-panel/95 text-[11px] pointer-events-none rounded-lg border p-3 backdrop-blur">
      <section>
        <h3 className="text-muted mb-1.5 font-medium uppercase tracking-wide">
          Hazard intensity
        </h3>
        <div
          className="h-2 w-full rounded-sm"
          style={{
            background: `linear-gradient(to right, ${HAZARD_TICKS.map(
              (t) => hazardColor(t),
            ).join(", ")})`,
          }}
        />
        <div className="text-muted mt-1 flex justify-between font-mono">
          <span>1 low</span>
          <span>10 severe</span>
        </div>
      </section>

      <section className="border-subtle mt-3 border-t pt-2.5">
        <h3 className="text-muted mb-1.5 font-medium uppercase tracking-wide">
          Relocation priority
        </h3>
        {ranks.length === 0 ? (
          <p className="text-muted font-mono">awaiting scores…</p>
        ) : (
          <div className="flex items-center gap-1.5">
            {ranks.map((rank) => (
              <span
                key={rank}
                title={`rank ${rank}`}
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: priorityColor(rank, rankTotal) }}
              />
            ))}
            <span className="text-muted ml-1 font-mono">
              rank 1 → {total}
            </span>
          </div>
        )}
      </section>

      <section className="border-subtle mt-3 border-t pt-2.5">
        <h3 className="text-muted mb-1.5 font-medium uppercase tracking-wide">
          Safe site capacity
        </h3>
        <div className="flex items-end gap-2.5">
          {CAPACITY_SAMPLES.map((capacity) => {
            const d = safeSiteRadius(capacity) * 1.5;
            return (
              <span key={capacity} className="flex flex-col items-center gap-1">
                <span
                  className="rounded-full border"
                  style={{
                    width: d,
                    height: d,
                    backgroundColor: "rgba(63,143,217,0.28)",
                    borderColor: "#5fa8ea",
                  }}
                />
                <span className="text-muted font-mono">{capacity}</span>
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}

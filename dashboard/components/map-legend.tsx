"use client";

import { hazardColor, priorityColor, safeSiteRadius } from "@/lib/theme";

const HAZARD_TICKS = [1, 3, 5, 7, 9, 10];
const PRIORITY_SAMPLE_RANKS = [1, 8, 18, 30, 41];
const CAPACITY_SAMPLES = [50, 200, 500];

/** Static key for the three map layers. */
export function MapLegend({ total }: { total: number }) {
  const rankTotal = Math.max(total, 2);

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
        <div className="flex items-center gap-1.5">
          {PRIORITY_SAMPLE_RANKS.map((rank) => (
            <span
              key={rank}
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: priorityColor(rank, rankTotal) }}
            />
          ))}
          <span className="text-muted ml-1 font-mono">rank 1 → last</span>
        </div>
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

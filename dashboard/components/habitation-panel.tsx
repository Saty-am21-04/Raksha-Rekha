"use client";

import { FACTOR_LABELS, FACTOR_ORDER } from "@/lib/scoring";
import type { ScoredHabitation } from "@/lib/scoring";
import { hazardColor, priorityColor } from "@/lib/theme";

const nf = new Intl.NumberFormat("en-IN");

interface HabitationPanelProps {
  habitation: ScoredHabitation;
  /** Total ranked habitations, so "#3 of 41" reads correctly. */
  total: number;
  /** True when values come from persisted rr_scores rather than derived here. */
  usingPersistedScores: boolean;
  onClose: () => void;
}

/**
 * Explainability panel for one habitation: its rr_scores values plus the
 * factor breakdown that produced the ranking.
 */
export function HabitationPanel({
  habitation,
  total,
  usingPersistedScores,
  onClose,
}: HabitationPanelProps) {
  const { score, detail } = habitation;
  const rank = score.priority_rank;
  const rankColor = priorityColor(rank, total);

  return (
    <section
      aria-label={`Risk breakdown for ${habitation.name}`}
      className="flex h-full flex-col overflow-y-auto"
    >
      {/* header */}
      <header className="border-subtle bg-panel sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{habitation.name}</h2>
          <p className="text-muted mt-0.5 text-xs">
            Population {nf.format(habitation.population)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="text-muted hover:text-fg hover:bg-panel-hover -mr-1 -mt-1 rounded p-1.5 text-lg leading-none transition-colors"
        >
          ×
        </button>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* rank */}
        <div className="border-subtle bg-bg-raised flex items-center justify-between rounded-lg border px-3 py-2.5">
          <span className="text-muted text-xs uppercase tracking-wide">
            Priority rank
          </span>
          <span className="flex items-baseline gap-1.5">
            <span
              className="font-mono text-xl font-semibold"
              style={{ color: rankColor }}
            >
              #{rank ?? "—"}
            </span>
            <span className="text-muted text-xs">of {total}</span>
          </span>
        </div>

        {/* the two rr_scores columns */}
        <div className="grid grid-cols-2 gap-2.5">
          <ScoreTile
            label="Hazard score"
            value={score.hazard_score}
            hint="Higher means greater exposure and severity"
            color="var(--rr-amber)"
          />
          <ScoreTile
            label="Capacity score"
            value={score.capacity_score}
            hint="Higher means better served by nearby safe sites"
            color="var(--rr-safe)"
          />
        </div>

        {/* factor_breakdown */}
        <div>
          <h3 className="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
            Factor breakdown
          </h3>
          {score.factor_breakdown ? (
            <ul className="flex flex-col gap-2">
              {FACTOR_ORDER.map((key) => {
                const value = score.factor_breakdown?.[key] ?? 0;
                return (
                  <li key={key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-[11px]">{FACTOR_LABELS[key]}</span>
                      <span className="text-muted font-mono text-[11px]">
                        {value.toFixed(2)}
                      </span>
                    </div>
                    <FactorBar value={value} label={FACTOR_LABELS[key]} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted text-xs">No breakdown available.</p>
          )}
        </div>

        {/* supporting context */}
        <div className="border-subtle flex flex-col gap-2 border-t pt-3 text-xs">
          <Row
            label="Nearest safe site"
            value={detail.nearestSafeSite?.name ?? "None found"}
          />
          {detail.nearestSafeSiteKm !== null && (
            <Row
              label="Distance"
              value={`${detail.nearestSafeSiteKm.toFixed(2)} km`}
              mono
            />
          )}
          {detail.nearestSafeSite && (
            <Row
              label="Site capacity"
              value={`${nf.format(detail.nearestSafeSite.capacity_max)} vs ${nf.format(habitation.population)} residents`}
              mono
              warn={detail.nearestSafeSite.capacity_max < habitation.population}
            />
          )}
        </div>

        {/* hazard zones acting on this habitation */}
        <div className="border-subtle border-t pt-3">
          <h3 className="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
            Hazard zones
          </h3>
          {detail.containingZones.length === 0 &&
          detail.nearbyZones.length === 0 ? (
            <p className="text-muted text-xs">
              Outside all hazard zones in this dataset.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {detail.containingZones.map((zone) => (
                <ZoneRow key={zone.id} zone={zone} inside />
              ))}
              {detail.nearbyZones.map((zone) => (
                <ZoneRow key={zone.id} zone={zone} inside={false} />
              ))}
            </ul>
          )}
        </div>

        {!usingPersistedScores && (
          <p className="text-muted border-subtle border-t pt-3 text-[11px] leading-relaxed">
            Scores derived in-app from rr_hazard_zones, rr_safe_sites and
            rr_habitations. rr_scores is empty in this project, so no persisted
            row exists yet.
          </p>
        )}
      </div>
    </section>
  );
}

function ScoreTile({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: number;
  hint: string;
  color: string;
}) {
  return (
    <div className="border-subtle bg-bg-raised rounded-lg border p-3">
      <p className="text-muted text-[11px] uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold" style={{ color }}>
        {value.toFixed(1)}
      </p>
      {/* track */}
      <div className="bg-subtle mt-1.5 h-1 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <p className="text-muted mt-1.5 text-[10px] leading-snug">{hint}</p>
    </div>
  );
}

/** Horizontal bar for one factor, 0–1. */
function FactorBar({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className="bg-subtle h-2 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={`${label}: ${value.toFixed(2)} out of 1`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{
          width: `${pct}%`,
          // Reuse the hazard ramp so a high factor reads as hot as a high zone.
          backgroundColor: hazardColor(1 + value * 9),
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  warn,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted shrink-0">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${warn ? "text-amber" : ""} text-right`}
      >
        {value}
      </span>
    </div>
  );
}

function ZoneRow({
  zone,
  inside,
}: {
  zone: { hazard_type: string; intensity: number; event_label: string | null };
  inside: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-sm"
          style={{ backgroundColor: hazardColor(zone.intensity) }}
        />
        <span className="truncate capitalize">
          {zone.hazard_type.replace(/_/g, " ")}
        </span>
        {zone.event_label && (
          <span className="text-muted truncate text-[10px]">
            {zone.event_label}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-muted font-mono">{zone.intensity}/10</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            inside
              ? "bg-amber/15 text-amber"
              : "bg-subtle text-muted"
          }`}
        >
          {inside ? "inside" : "nearby"}
        </span>
      </span>
    </li>
  );
}

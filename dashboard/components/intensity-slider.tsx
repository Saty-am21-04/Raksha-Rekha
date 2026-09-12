"use client";

/**
 * What-if control for hazard intensity.
 *
 * The track is 0–100 as specified. 50 is the baseline, so the range spans 0x
 * (hazard removed) through 1x (as recorded) to 2x (doubled) — a slider that
 * could only reduce intensity would not answer "what if the next monsoon is
 * worse". The derived multiplier is shown next to the label so the number being
 * applied is never implicit.
 */

export const SLIDER_BASELINE = 50;
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 100;

/** 0–100 track position to the multiplier the scoring model consumes. */
export function sliderToMultiplier(value: number): number {
  return value / SLIDER_BASELINE;
}

interface IntensitySliderProps {
  /** Track position, 0–100. */
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
  /** Live count of habitations sitting inside a hazard zone, for feedback. */
  atRiskCount: number;
}

export function IntensitySlider({
  value,
  onChange,
  onReset,
  atRiskCount,
}: IntensitySliderProps) {
  const multiplier = sliderToMultiplier(value);
  const simulating = value !== SLIDER_BASELINE;

  return (
    <div className="border-subtle bg-bg-raised flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <label
          htmlFor="intensity-multiplier"
          className="shrink-0 text-[11px] font-medium"
        >
          Hazard Intensity Multiplier
        </label>
        <span
          className={`shrink-0 font-mono text-[11px] ${
            simulating ? "text-amber" : "text-muted"
          }`}
        >
          {multiplier.toFixed(2)}×
        </span>
      </div>

      <div className="flex min-w-[180px] flex-1 items-center gap-2">
        <span className="text-muted shrink-0 font-mono text-[10px]">0</span>
        <input
          id="intensity-multiplier"
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`${multiplier.toFixed(2)} times recorded intensity`}
          className="accent-amber h-1 w-full min-w-0 cursor-pointer"
        />
        <span className="text-muted shrink-0 font-mono text-[10px]">
          {SLIDER_MAX}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span className="text-muted font-mono text-[10px]">
          {atRiskCount} in hazard zone
        </span>

        {simulating && (
          <span
            role="status"
            className="border-amber/40 bg-amber/10 text-amber rounded border px-2 py-0.5 text-[10px] font-medium"
          >
            Simulated — not saved
          </span>
        )}

        <button
          type="button"
          onClick={onReset}
          disabled={!simulating}
          title="Return to the persisted baseline scores in rr_scores"
          className="border-subtle-strong hover:border-amber hover:text-amber text-muted rounded border px-2 py-0.5 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

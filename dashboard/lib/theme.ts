/**
 * Shared visual scales.
 *
 * The map layers and the React chrome (list badges, legend, panel) read from
 * the same stops here, so a habitation's dot on the map always matches its
 * badge in the priority list.
 */

/** Hazard intensity 1–10 → dim amber through bright amber to red. */
const HAZARD_STOPS: [number, string][] = [
  [1, "#4a3316"],
  [4, "#a8752f"],
  [7, "#d99b3f"],
  [9, "#e2652f"],
  [10, "#d93f3f"],
];

/** Priority fraction 0 (most urgent) → 1 (least) → amber-red through grey. */
const PRIORITY_STOPS: [number, string][] = [
  [0, "#d93f3f"],
  [0.15, "#e2652f"],
  [0.35, "#d99b3f"],
  [0.6, "#8a6a35"],
  [1, "#4a4a4a"],
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const to = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Piecewise-linear colour lookup mirroring Mapbox's `interpolate` output. */
function rampColor(stops: [number, string][], value: number): string {
  if (value <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (value >= last[0]) return last[1];

  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, c0] = stops[i];
    const [x1, c1] = stops[i + 1];
    if (value < x0 || value > x1) continue;

    const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
    const a = hexToRgb(c0);
    const b = hexToRgb(c1);
    return rgbToHex([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]);
  }
  return last[1];
}

export function hazardColor(intensity: number): string {
  return rampColor(HAZARD_STOPS, intensity);
}

/** Fill opacity grows with intensity so faint zones stay readable. */
export function hazardOpacity(intensity: number): number {
  const t = Math.min(1, Math.max(0, (intensity - 1) / 9));
  return 0.15 + t * 0.4;
}

/**
 * Colour for a habitation by rank. `total` normalises the ramp so the spread
 * always spans the visible dataset.
 */
export function priorityColor(rank: number | null, total: number): string {
  if (rank === null) return "#4a4a4a";
  const fraction = total <= 1 ? 0 : (rank - 1) / (total - 1);
  return rampColor(PRIORITY_STOPS, fraction);
}

/** Safe-site marker radius in px, scaled by capacity (50–500 in the seed). */
export function safeSiteRadius(capacityMax: number): number {
  const t = Math.min(1, Math.max(0, (capacityMax - 50) / 450));
  // sqrt keeps the largest site from dwarfing the smallest.
  return 5 + Math.sqrt(t) * 13;
}

/** Mapbox `interpolate` expression equivalents, so map and UI never drift. */
export const mapExpressions = {
  hazardColor: [
    "interpolate",
    ["linear"],
    ["get", "intensity"],
    ...HAZARD_STOPS.flat(),
  ],
  hazardOpacity: [
    "interpolate",
    ["linear"],
    ["get", "intensity"],
    1,
    0.15,
    10,
    0.55,
  ],
  priorityColor: [
    "interpolate",
    ["linear"],
    ["get", "priorityFraction"],
    ...PRIORITY_STOPS.flat(),
  ],
} as const;

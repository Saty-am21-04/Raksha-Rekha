/**
 * One-page SDMA report, generated entirely in the browser.
 *
 * jspdf and jspdf-autotable are imported dynamically from the click handler so
 * neither lands in the initial bundle — the export is a rare action and should
 * not cost every visitor the download.
 */

import type { ScoredHabitation } from "@/lib/scoring";
import type { DataSource, SafeSite } from "@/lib/supabase/types";

/** A4 landscape, in millimetres. */
const PAGE = { width: 297, height: 210 } as const;
const MARGIN = 12;

const AMBER = [217, 155, 63] as const;
const INK = [30, 30, 30] as const;
const MUTED = [120, 120, 120] as const;

const nf = new Intl.NumberFormat("en-IN");

export interface ReportInput {
  ranked: ScoredHabitation[];
  safeSites: SafeSite[];
  source: DataSource;
  eventLabel: string | null;
  /** PNG data URL of the map canvas, or null if capture failed. */
  mapImage: string | null;
  isSimulating: boolean;
  intensityMultiplier: number;
  hazardZoneCount: number;
  lastComputedAt: string | null;
}

/**
 * Builds the document and returns it with its filename, without saving.
 *
 * Kept separate from generateSdmaReport so the layout can be exercised outside a
 * browser — doc.save() needs a DOM, but building and inspecting the PDF does not.
 */
export async function buildSdmaReport(
  input: ReportInput,
): Promise<{ doc: import("jspdf").jsPDF; filename: string }> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const generatedAt = new Date();

  /* ---------------- header ---------------- */
  doc.setFillColor(17, 17, 17);
  doc.rect(0, 0, PAGE.width, 20, "F");

  doc.setTextColor(232, 232, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RAKSHA-REKHA", MARGIN, 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...AMBER);
  doc.text("SDMA Relocation Priority Report", MARGIN, 14.5);

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7.5);
  doc.text(
    `Wayanad District, Kerala  ·  generated ${generatedAt.toLocaleString("en-IN")}`,
    PAGE.width - MARGIN,
    9,
    { align: "right" },
  );
  doc.text(
    input.lastComputedAt
      ? `Scores computed ${new Date(input.lastComputedAt).toLocaleString("en-IN")}`
      : "Scores computed in-session",
    PAGE.width - MARGIN,
    14.5,
    { align: "right" },
  );

  /* ---------------- mode banner ----------------
     The dataset in play changes what the numbers mean, so it is stated
     unambiguously rather than left to a legend. */
  const modeY = 24;
  const historical = input.source === "historical";

  if (historical) {
    doc.setFillColor(AMBER[0], AMBER[1], AMBER[2]);
  } else {
    doc.setFillColor(38, 38, 38);
  }
  doc.rect(MARGIN, modeY, PAGE.width - MARGIN * 2, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  // Amber banner takes dark text; the neutral banner takes light text.
  if (historical) {
    doc.setTextColor(20, 20, 20);
  } else {
    doc.setTextColor(230, 230, 230);
  }
  doc.text(
    historical
      ? `HISTORICAL REPLAY — ${input.eventLabel ?? "historical dataset"}`
      : "SYNTHETIC PLANNING DATASET",
    MARGIN + 3,
    modeY + 5.4,
  );

  doc.setFont("helvetica", "normal");
  doc.text(
    `${input.hazardZoneCount} hazard zones  ·  ${input.ranked.length} habitations  ·  ${input.safeSites.length} safe sites`,
    PAGE.width - MARGIN - 3,
    modeY + 5.4,
    { align: "right" },
  );

  /* ---------------- simulation warning ----------------
     A simulated report must never be mistaken for the persisted baseline. */
  let cursorY = modeY + 12;
  if (input.isSimulating) {
    doc.setFillColor(255, 244, 224);
    doc.setDrawColor(...AMBER);
    doc.rect(MARGIN, cursorY, PAGE.width - MARGIN * 2, 7, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(140, 90, 10);
    doc.text(
      `SIMULATION — hazard intensity multiplier ${input.intensityMultiplier.toFixed(2)}x. ` +
        `Not the persisted baseline and not saved to rr_scores.`,
      MARGIN + 3,
      cursorY + 4.8,
    );
    cursorY += 10;
  }

  /* ---------------- map snapshot ---------------- */
  const colWidth = (PAGE.width - MARGIN * 2 - 6) / 2;
  const mapHeight = PAGE.height - cursorY - MARGIN - 6;

  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, cursorY, colWidth, mapHeight, "FD");

  if (input.mapImage) {
    // Inset by the border so the frame stays visible.
    doc.addImage(
      input.mapImage,
      "PNG",
      MARGIN + 0.4,
      cursorY + 0.4,
      colWidth - 0.8,
      mapHeight - 0.8,
      undefined,
      "FAST",
    );
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      "Map snapshot unavailable",
      MARGIN + colWidth / 2,
      cursorY + mapHeight / 2,
      { align: "center" },
    );
  }

  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "Hazard zones shaded by intensity · blue = relocation sites · dots ranked by priority",
    MARGIN,
    cursorY + mapHeight + 3.5,
  );

  /* ---------------- top 10 table ---------------- */
  const siteName = new Map(
    input.safeSites.map((s) => [s.id, s.name ?? "Unnamed site"]),
  );

  const rows = input.ranked.slice(0, 10).map((r) => [
    r.score.priority_rank ?? "—",
    r.name,
    nf.format(r.population),
    r.score.hazard_score.toFixed(1),
    r.score.capacity_score.toFixed(1),
    r.detail.nearestSafeSite?.name ??
      siteName.get(r.score.nearest_safe_site_id ?? "") ??
      "None",
  ]);

  const tableX = MARGIN + colWidth + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Top 10 Priority Habitations", tableX, cursorY + 4);

  autoTable(doc, {
    startY: cursorY + 7,
    margin: { left: tableX, right: MARGIN },
    tableWidth: colWidth,
    head: [["#", "Habitation", "Pop.", "Hazard", "Capacity", "Nearest safe site"]],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.6,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [26, 26, 26],
      textColor: [232, 232, 232],
      fontSize: 7,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 7, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 14, halign: "right" },
      3: { cellWidth: 15, halign: "right" },
      4: { cellWidth: 17, halign: "right" },
    },
  });

  /* ---------------- footnotes ---------------- */
  // `as` cast: autotable augments the doc at runtime; its type isn't on jsPDF.
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? cursorY + 60;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(
    [
      "Hazard score: 0.40 x zone intensity + 0.35 x hazard-type severity + 0.25 x historical recurrence, scaled to 100.",
      "Capacity score: share of the population assigned to the nearest safe site that the site can absorb, allowing for infrastructure readiness.",
      "Prototype output for SIH 2026. Not an operational evacuation order.",
    ],
    tableX,
    finalY + 4,
    { maxWidth: colWidth, lineHeightFactor: 1.5 },
  );

  const stamp = generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `raksha-rekha-sdma-${input.source}${
    input.isSimulating ? "-simulated" : ""
  }-${stamp}.pdf`;

  return { doc, filename };
}

/** Builds the report and hands the browser a download. Returns the filename. */
export async function generateSdmaReport(input: ReportInput): Promise<string> {
  const { doc, filename } = await buildSdmaReport(input);
  doc.save(filename);
  return filename;
}

/**
 * Snapshot the Mapbox canvas as a PNG data URL.
 *
 * Depends on preserveDrawingBuffer being set when the map is constructed;
 * without it a WebGL buffer is cleared after each frame and this returns blank
 * pixels. Returns null rather than throwing so a failed capture degrades to a
 * placeholder instead of losing the whole report.
 */
export function captureMapImage(
  map: { getCanvas: () => HTMLCanvasElement; triggerRepaint?: () => void } | null,
): string | null {
  if (!map) return null;
  try {
    const canvas = map.getCanvas();
    if (!canvas.width || !canvas.height) return null;
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

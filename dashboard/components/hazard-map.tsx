"use client";

import type { FeatureCollection, Geometry } from "geojson";
import mapboxgl from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { env } from "@/lib/env";
import { bboxOf, toLngLat } from "@/lib/geo";
import {
  habitationsToGeoJSON,
  hazardZonesToGeoJSON,
  safeSitesToGeoJSON,
} from "@/lib/geojson";
import type { ScoredHabitation } from "@/lib/scoring";
import { mapExpressions } from "@/lib/theme";
import type { HazardZone, SafeSite } from "@/lib/supabase/types";

const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

/** Fallback extent (Wayanad) used before data lands. */
const FALLBACK_BOUNDS: [[number, number], [number, number]] = [
  [76.0, 11.595],
  [76.105, 11.73],
];

const SOURCES = {
  hazard: "rr-hazard-zones",
  safe: "rr-safe-sites",
  habitation: "rr-habitations",
} as const;

const LAYERS = {
  hazardFill: "hazard-fill",
  hazardOutline: "hazard-outline",
  safeSites: "safe-sites",
  habitations: "habitations",
  habitationSelected: "habitation-selected",
} as const;

type AnyCollection = FeatureCollection<Geometry, never>;

interface LayerData {
  hazard: AnyCollection;
  safe: AnyCollection;
  habitation: AnyCollection;
}

interface HazardMapProps {
  hazardZones: HazardZone[];
  safeSites: SafeSite[];
  ranked: ScoredHabitation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function HazardMap({
  hazardZones,
  safeSites,
  ranked,
  selectedId,
  onSelect,
}: HazardMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  /**
   * Tracks whether *this* map instance finished building its layers. It is only
   * ever read for behaviour that is safe to skip and retry (framing, easing) —
   * never to gate style mutations, since a boolean can't distinguish one map
   * instance from another across a StrictMode remount.
   */
  const [layersReady, setLayersReady] = useState(false);

  // Latest values the map's own callbacks need, without re-running the setup
  // effect and tearing the map down.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const hazardData = useMemo(
    () => hazardZonesToGeoJSON(hazardZones) as unknown as AnyCollection,
    [hazardZones],
  );
  const safeData = useMemo(
    () => safeSitesToGeoJSON(safeSites) as unknown as AnyCollection,
    [safeSites],
  );
  const habitationData = useMemo(
    () =>
      habitationsToGeoJSON(ranked, selectedId) as unknown as AnyCollection,
    [ranked, selectedId],
  );

  /**
   * Seeded with the first render's collections so the map's load callback has
   * something to build from even before the sync effect below has run.
   */
  const dataRef = useRef<LayerData>({
    hazard: hazardData,
    safe: safeData,
    habitation: habitationData,
  });
  useEffect(() => {
    dataRef.current = { hazard: hazardData, safe: safeData, habitation: habitationData };
  }, [hazardData, safeData, habitationData]);

  /* ---------- create the map, and build layers from its own load event ---------- */
  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = env.mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: FALLBACK_BOUNDS,
      fitBoundsOptions: { padding: 48 },
      attributionControl: false,
    });
    mapRef.current = map;

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      maxWidth: "240px",
    });
    popupRef.current = popup;

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

    // Everything that mutates the style happens here, where the style is
    // guaranteed loaded for THIS instance.
    const onLoad = () => {
      installLayers(map, dataRef.current);
      installInteractions(map, popup, onSelectRef);
      setLayersReady(true);
    };
    map.on("load", onLoad);

    return () => {
      map.off("load", onLoad);
      popup.remove();
      // remove() tears down every listener and source on this instance.
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
      setLayersReady(false);
    };
  }, []);

  /* ---------- keep canvas sized to its container ---------- */
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      // Skip while hidden (mobile tab switch) so the canvas isn't sized to 0.
      if (node.clientWidth === 0 || node.clientHeight === 0) return;
      mapRef.current?.resize();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ---------- push data updates ---------- */
  useEffect(() => {
    pushData(mapRef.current, SOURCES.hazard, hazardData);
  }, [layersReady, hazardData]);

  useEffect(() => {
    pushData(mapRef.current, SOURCES.safe, safeData);
  }, [layersReady, safeData]);

  useEffect(() => {
    pushData(mapRef.current, SOURCES.habitation, habitationData);
  }, [layersReady, habitationData]);

  /* ---------- frame the data once it arrives ---------- */
  const framedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReady || framedRef.current) return;
    if (ranked.length === 0 && hazardZones.length === 0) return;

    const points = [
      ...ranked.map((r) => toLngLat(r.geom)),
      ...safeSites.map((s) => toLngLat(s.geom)),
      ...hazardZones.flatMap((z) =>
        z.geom.coordinates[0].map(([lng, lat]) => ({ lng, lat })),
      ),
    ];

    const box = bboxOf(points);
    if (!box) return;

    map.fitBounds(
      [
        [box[0], box[1]],
        [box[2], box[3]],
      ],
      { padding: 56, duration: 0 },
    );
    framedRef.current = true;
  }, [layersReady, ranked, safeSites, hazardZones]);

  /* ---------- ease to a selection made elsewhere (list, panel) ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReady || !selectedId) return;

    const target = ranked.find((r) => r.id === selectedId);
    if (!target) return;

    const { lng, lat } = toLngLat(target.geom);
    if (!map.getBounds()?.contains([lng, lat])) {
      map.easeTo({ center: [lng, lat], duration: 600 });
    }
  }, [selectedId, ranked, layersReady]);

  return (
    <div
      ref={containerRef}
      className="bg-bg h-full w-full"
      role="application"
      aria-label="Hazard and relocation map for Wayanad"
    />
  );
}

/* ============================================================
   Style mutations — only ever called from the map's load event
   ============================================================ */

function installLayers(map: mapboxgl.Map, data: LayerData) {
  map.addSource(SOURCES.hazard, { type: "geojson", data: data.hazard });
  map.addSource(SOURCES.safe, { type: "geojson", data: data.safe });
  map.addSource(SOURCES.habitation, {
    type: "geojson",
    data: data.habitation,
  });

  // Hazard polygons sit underneath the point layers.
  map.addLayer({
    id: LAYERS.hazardFill,
    type: "fill",
    source: SOURCES.hazard,
    paint: {
      "fill-color": mapExpressions.hazardColor as never,
      "fill-opacity": mapExpressions.hazardOpacity as never,
    },
  });

  map.addLayer({
    id: LAYERS.hazardOutline,
    type: "line",
    source: SOURCES.hazard,
    paint: {
      "line-color": mapExpressions.hazardColor as never,
      "line-width": 1.2,
      "line-opacity": 0.9,
    },
  });

  // Safe sites: blue, area scaled by capacity_max.
  map.addLayer({
    id: LAYERS.safeSites,
    type: "circle",
    source: SOURCES.safe,
    paint: {
      "circle-radius": ["get", "radius"],
      "circle-color": "#3f8fd9",
      "circle-opacity": 0.28,
      "circle-stroke-color": "#5fa8ea",
      "circle-stroke-width": 1.5,
      "circle-stroke-opacity": 0.95,
    },
  });

  // Habitations: colour ramped by priority_rank.
  map.addLayer({
    id: LAYERS.habitations,
    type: "circle",
    source: SOURCES.habitation,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        3.5,
        13,
        6,
        16,
        9,
      ],
      "circle-color": mapExpressions.priorityColor as never,
      "circle-stroke-color": "#0a0a0a",
      "circle-stroke-width": 1,
    },
  });

  // Selection ring, driven by the `selected` feature property.
  map.addLayer({
    id: LAYERS.habitationSelected,
    type: "circle",
    source: SOURCES.habitation,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        8,
        13,
        12,
        16,
        16,
      ],
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#d99b3f",
      "circle-stroke-width": 2.5,
    },
  });
}

function installInteractions(
  map: mapboxgl.Map,
  popup: mapboxgl.Popup,
  onSelectRef: { current: (id: string | null) => void },
) {
  const showPointer = () => {
    map.getCanvas().style.cursor = "pointer";
  };
  const reset = () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  };

  map.on("click", LAYERS.habitations, (e) => {
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "string") onSelectRef.current(id);
  });

  // A bare-map click clears the selection.
  map.on("click", (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: [LAYERS.habitations],
    });
    if (hits.length === 0) onSelectRef.current(null);
  });

  map.on("mousemove", LAYERS.habitations, (e) => {
    showPointer();
    const p = e.features?.[0]?.properties;
    if (!p) return;
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<strong>${escapeHtml(String(p.name))}</strong><br/>` +
          `<span style="color:#8a8a8a">Rank</span> ` +
          `<span style="color:#d99b3f">#${p.priority_rank ?? "—"}</span> · ` +
          `<span style="color:#8a8a8a">pop</span> ${Number(p.population).toLocaleString("en-IN")}`,
      )
      .addTo(map);
  });
  map.on("mouseleave", LAYERS.habitations, reset);

  map.on("mousemove", LAYERS.safeSites, (e) => {
    showPointer();
    const p = e.features?.[0]?.properties;
    if (!p) return;
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<strong>${escapeHtml(String(p.name))}</strong><br/>` +
          `<span style="color:#8a8a8a">capacity</span> ` +
          `<span style="color:#5fa8ea">${Number(p.capacity_max).toLocaleString("en-IN")}</span>` +
          (p.infra_score === null || p.infra_score === undefined
            ? ""
            : ` · <span style="color:#8a8a8a">infra</span> ${p.infra_score}`),
      )
      .addTo(map);
  });
  map.on("mouseleave", LAYERS.safeSites, reset);

  map.on("mousemove", LAYERS.hazardFill, (e) => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const label = p.event_label
      ? `<br/><em>${escapeHtml(String(p.event_label))}</em>`
      : "";
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<strong style="text-transform:capitalize">${escapeHtml(
          String(p.hazard_type).replace(/_/g, " "),
        )}</strong><br/>` +
          `<span style="color:#8a8a8a">intensity</span> ` +
          `<span style="color:#d99b3f">${p.intensity}/10</span>${label}`,
      )
      .addTo(map);
  });
  map.on("mouseleave", LAYERS.hazardFill, reset);
}

/**
 * Update a source's data if that source exists on the current instance.
 *
 * Guarding on getSource rather than a readiness flag means a stale update
 * aimed at a torn-down map is a no-op instead of a throw.
 */
function pushData(
  map: mapboxgl.Map | null,
  sourceId: string,
  data: AnyCollection,
) {
  if (!map || !map.style || !map.isStyleLoaded()) return;

  const source = map.getSource(sourceId);
  if (!source || source.type !== "geojson") return;

  source.setData(data as unknown as FeatureCollection);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

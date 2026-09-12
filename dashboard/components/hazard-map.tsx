"use client";

import type { FeatureCollection, Geometry } from "geojson";
import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [styleReady, setStyleReady] = useState(false);

  // Keep the newest onSelect in a ref so the click handler can stay registered
  // once for the map's lifetime instead of rebinding on every render.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const hazardData = useMemo(
    () => hazardZonesToGeoJSON(hazardZones),
    [hazardZones],
  );
  const safeData = useMemo(() => safeSitesToGeoJSON(safeSites), [safeSites]);
  const habitationData = useMemo(
    () => habitationsToGeoJSON(ranked, selectedId),
    [ranked, selectedId],
  );

  /* ---------- create the map once ---------- */
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    mapboxgl.accessToken = env.mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: FALLBACK_BOUNDS,
      fitBoundsOptions: { padding: 48 },
      attributionControl: false,
    });

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      maxWidth: "240px",
    });

    map.on("load", () => setStyleReady(true));
    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  /* ---------- keep canvas sized to its container ---------- */
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ---------- add sources and layers after style load ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    if (!map.getSource(SOURCES.hazard)) {
      map.addSource(SOURCES.hazard, { type: "geojson", data: hazardData });
      map.addSource(SOURCES.safe, { type: "geojson", data: safeData });
      map.addSource(SOURCES.habitation, {
        type: "geojson",
        data: habitationData,
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

    /* ---------- interactions ---------- */
    const popup = popupRef.current;

    const selectFeature = (e: mapboxgl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") onSelectRef.current(id);
    };

    // Clicking empty map clears the selection; layer handlers stop propagation
    // by running first and setting a flag on the original event.
    const clearSelection = (e: mapboxgl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [LAYERS.habitations],
      });
      if (hits.length === 0) onSelectRef.current(null);
    };

    const showPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const hidePointer = () => {
      map.getCanvas().style.cursor = "";
      popup?.remove();
    };

    const habitationHover = (e: mapboxgl.MapLayerMouseEvent) => {
      showPointer();
      const p = e.features?.[0]?.properties;
      if (!p || !popup) return;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong>${escapeHtml(String(p.name))}</strong><br/>` +
            `<span style="color:#8a8a8a">Rank</span> ` +
            `<span style="color:#d99b3f">#${p.priority_rank ?? "—"}</span> · ` +
            `<span style="color:#8a8a8a">pop</span> ${Number(p.population).toLocaleString("en-IN")}`,
        )
        .addTo(map);
    };

    const safeHover = (e: mapboxgl.MapLayerMouseEvent) => {
      showPointer();
      const p = e.features?.[0]?.properties;
      if (!p || !popup) return;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong>${escapeHtml(String(p.name))}</strong><br/>` +
            `<span style="color:#8a8a8a">capacity</span> ` +
            `<span style="color:#5fa8ea">${Number(p.capacity_max).toLocaleString("en-IN")}</span>` +
            (p.infra_score === null
              ? ""
              : ` · <span style="color:#8a8a8a">infra</span> ${p.infra_score}`),
        )
        .addTo(map);
    };

    const hazardHover = (e: mapboxgl.MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties;
      if (!p || !popup) return;
      const label = p.event_label ? `<br/><em>${escapeHtml(String(p.event_label))}</em>` : "";
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong style="text-transform:capitalize">${escapeHtml(String(p.hazard_type).replace(/_/g, " "))}</strong><br/>` +
            `<span style="color:#8a8a8a">intensity</span> ` +
            `<span style="color:#d99b3f">${p.intensity}/10</span>${label}`,
        )
        .addTo(map);
    };

    map.on("click", LAYERS.habitations, selectFeature);
    map.on("click", clearSelection);
    map.on("mousemove", LAYERS.habitations, habitationHover);
    map.on("mouseleave", LAYERS.habitations, hidePointer);
    map.on("mousemove", LAYERS.safeSites, safeHover);
    map.on("mouseleave", LAYERS.safeSites, hidePointer);
    map.on("mousemove", LAYERS.hazardFill, hazardHover);
    map.on("mouseleave", LAYERS.hazardFill, hidePointer);

    return () => {
      map.off("click", LAYERS.habitations, selectFeature);
      map.off("click", clearSelection);
      map.off("mousemove", LAYERS.habitations, habitationHover);
      map.off("mouseleave", LAYERS.habitations, hidePointer);
      map.off("mousemove", LAYERS.safeSites, safeHover);
      map.off("mouseleave", LAYERS.safeSites, hidePointer);
      map.off("mousemove", LAYERS.hazardFill, hazardHover);
      map.off("mouseleave", LAYERS.hazardFill, hidePointer);
    };
  }, [styleReady, hazardData, safeData, habitationData]);

  /* ---------- push data updates ---------- */
  const setData = useCallback(
    <G extends Geometry, P>(sourceId: string, data: FeatureCollection<G, P>) => {
      const source = mapRef.current?.getSource(sourceId);
      if (!source || source.type !== "geojson") return;
      // Mapbox's setData signature wants the loose GeoJSON type; our narrower
      // collections are structurally compatible.
      source.setData(data as unknown as FeatureCollection);
    },
    [],
  );

  useEffect(() => {
    if (styleReady) setData(SOURCES.hazard, hazardData);
  }, [styleReady, hazardData, setData]);

  useEffect(() => {
    if (styleReady) setData(SOURCES.safe, safeData);
  }, [styleReady, safeData, setData]);

  useEffect(() => {
    if (styleReady) setData(SOURCES.habitation, habitationData);
  }, [styleReady, habitationData, setData]);

  /* ---------- frame the data once it arrives ---------- */
  const framedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || framedRef.current) return;
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
  }, [styleReady, ranked, safeSites, hazardZones]);

  /* ---------- ease to a selection made elsewhere (list, panel) ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !selectedId) return;

    const target = ranked.find((r) => r.id === selectedId);
    if (!target) return;

    const { lng, lat } = toLngLat(target.geom);
    // Only move if the point isn't already comfortably in view.
    if (!map.getBounds()?.contains([lng, lat])) {
      map.easeTo({ center: [lng, lat], duration: 600 });
    }
  }, [selectedId, ranked, styleReady]);

  return (
    <div
      ref={containerRef}
      className="bg-bg h-full w-full"
      role="application"
      aria-label="Hazard and relocation map for Wayanad"
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

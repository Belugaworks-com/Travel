"use client";

import type { Feature, FeatureCollection, LineString } from "geojson";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import { useEffect, useRef } from "react";

import { AIRPORTS, getAirport } from "@/lib/data/airports";
import { getDirectDestinations } from "@/lib/data/network";
import { greatCircle } from "@/lib/geo";
import { useSkyPlan } from "@/lib/store";

import { EMPTY_LINES, buildStyle, readMapColors } from "./map-style";

setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

/** Codes for every airport appear from this zoom; below it only on focus. */
const LABEL_ZOOM = 3.4;
const REVEAL_MS = 900;
const DASH_SEQUENCE: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;

/** Space the side panel (desktop) or bottom sheet (mobile) covers. */
function panelPadding(open: boolean) {
  if (!open) return { top: 40, right: 40, bottom: 40, left: 40 };
  return isDesktop()
    ? { top: 60, right: 460, bottom: 60, left: 60 }
    : { top: 30, right: 30, bottom: Math.round(window.innerHeight * 0.55), left: 30 };
}

interface MapHandle {
  map: MapLibreMap | null;
  loaded: boolean;
  pending: Set<(map: MapLibreMap) => void>;
}

/** Run a callback now if the style is loaded, otherwise once it is. Returns a cleanup. */
function runWhenReady(handle: MapHandle, fn: (map: MapLibreMap) => void) {
  if (handle.map && handle.loaded) {
    fn(handle.map);
    return () => {};
  }
  handle.pending.add(fn);
  return () => {
    handle.pending.delete(fn);
  };
}

function applyMarkerStates(markers: Map<string, HTMLButtonElement>, selected: string | null, routeTo: string | null) {
  const destinations = new Set(selected ? getDirectDestinations(selected) : []);
  for (const [iata, el] of markers) {
    const state =
      iata === selected || iata === routeTo
        ? "selected"
        : !selected
          ? "idle"
          : destinations.has(iata)
            ? "destination"
            : "muted";
    el.dataset.state = state;
    el.setAttribute("aria-pressed", String(iata === selected));
    el.parentElement?.style.setProperty("z-index", state === "selected" ? "3" : state === "destination" ? "2" : "1");
  }
}

type ArcProps = { dest: string; active: boolean; dim: number };

function arcFeatures(origin: string, routeTo: string | null): Feature<LineString, ArcProps>[] {
  const from = getAirport(origin);
  if (!from) return [];
  return getDirectDestinations(origin).map((dest) => {
    const to = getAirport(dest)!;
    return {
      type: "Feature",
      properties: { dest, active: dest === routeTo, dim: routeTo ? 0.16 : 0.6 },
      geometry: { type: "LineString", coordinates: greatCircle(from, to, 72) },
    };
  });
}

export function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle>({ map: null, loaded: false, pending: new Set() });
  const markersRef = useRef(new Map<string, HTMLButtonElement>());
  const revealRef = useRef<number | null>(null);

  const selected = useSkyPlan((s) => s.selected);
  const routeTo = useSkyPlan((s) => s.routeTo);
  const projection = useSkyPlan((s) => s.projection);
  const selectAirport = useSkyPlan((s) => s.selectAirport);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new MapLibreMap({
      container,
      style: buildStyle(readMapColors(document.documentElement), useSkyPlan.getState().projection),
      center: [12, 28],
      zoom: isDesktop() ? 2.15 : 1.1,
      minZoom: 0.6,
      maxZoom: 8,
      attributionControl: false,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true, customAttribution: "Natural Earth" }), "bottom-right");
    const handle = handleRef.current;
    handle.map = map;

    const syncLabelZoom = () => {
      container.dataset.labels = map.getZoom() >= LABEL_ZOOM ? "all" : "focus";
    };
    map.on("zoom", syncLabelZoom);
    syncLabelZoom();

    for (const airport of AIRPORTS) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "airport-marker";
      el.setAttribute("aria-label", `${airport.city} ${airport.name} (${airport.iata})`);
      el.innerHTML = `<span class="airport-marker__dot"></span><span class="airport-marker__code">${airport.iata}</span>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        useSkyPlan.getState().selectAirport(airport.iata);
      });
      new Marker({ element: el, anchor: "left", offset: [-7, 0], opacityWhenCovered: "0" })
        .setLngLat([airport.lon, airport.lat])
        .addTo(map);
      markersRef.current.set(airport.iata, el);
    }

    map.on("load", () => {
      handle.loaded = true;
      for (const fn of handle.pending) fn(map);
      handle.pending.clear();
    });

    // Flowing dashes along the open route.
    let step = 0;
    const flow = window.setInterval(() => {
      // Only animate while a route is open; repainting costs GPU time.
      if (!handle.loaded || !useSkyPlan.getState().routeTo || prefersReducedMotion()) return;
      step = (step + 1) % DASH_SEQUENCE.length;
      map.setPaintProperty("arcs-flow", "line-dasharray", DASH_SEQUENCE[step]);
    }, 60);

    const markers = markersRef.current;
    return () => {
      window.clearInterval(flow);
      map.remove();
      handle.map = null;
      handle.loaded = false;
      handle.pending.clear();
      markers.clear();
    };
  }, []);

  // Projection toggle.
  useEffect(() => runWhenReady(handleRef.current, (map) => map.setProjection({ type: projection })), [projection]);

  // Theme: repaint the basemap from CSS tokens whenever <html>'s class changes.
  // (next-themes toggles the class after React effects run, so observe it.)
  useEffect(() => {
    const repaint = () =>
      runWhenReady(handleRef.current, (map) => {
        const c = readMapColors(document.documentElement);
        map.setPaintProperty("ocean", "background-color", c.ocean);
        map.setPaintProperty("land", "fill-color", c.land);
        map.setPaintProperty("borders", "line-color", c.border);
        map.setPaintProperty("graticule", "line-color", c.graticule);
        map.setPaintProperty("arcs-base", "line-color", c.signal);
        map.setPaintProperty("arcs-flow", "line-color", c.foreground);
      });
    const observer = new MutationObserver(() => repaint());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Marker states.
  useEffect(() => applyMarkerStates(markersRef.current, selected, routeTo), [selected, routeTo]);

  // Arcs: draw in when the origin changes; restyle when a route opens.
  const drawnOriginRef = useRef<string | null>(null);
  useEffect(
    () =>
      runWhenReady(handleRef.current, (map) => {
        const source = map.getSource<GeoJSONSource>("arcs");
        if (!source) return;
        if (revealRef.current) cancelAnimationFrame(revealRef.current);

        if (!selected) {
          source.setData(EMPTY_LINES);
          drawnOriginRef.current = null;
          return;
        }
        const features = arcFeatures(selected, routeTo);
        const full: FeatureCollection<LineString, ArcProps> = { type: "FeatureCollection", features };

        if (drawnOriginRef.current === selected || prefersReducedMotion()) {
          source.setData(full);
          drawnOriginRef.current = selected;
          return;
        }
        drawnOriginRef.current = selected;
        const start = performance.now();
        const frame = (now: number) => {
          const t = Math.min(1, (now - start) / REVEAL_MS);
          const eased = 1 - (1 - t) ** 3;
          source.setData({
            type: "FeatureCollection",
            features: features.map((f) => {
              const pts = f.geometry.coordinates;
              const n = Math.max(2, Math.ceil(pts.length * eased));
              return { ...f, geometry: { type: "LineString", coordinates: pts.slice(0, n) } };
            }),
          });
          if (t < 1) revealRef.current = requestAnimationFrame(frame);
        };
        revealRef.current = requestAnimationFrame(frame);
      }),
    [selected, routeTo],
  );

  // Camera.
  useEffect(
    () =>
      runWhenReady(handleRef.current, (map) => {
        const animate = !prefersReducedMotion();
        const from = selected ? getAirport(selected) : null;
        const to = routeTo ? getAirport(routeTo) : null;
        if (from && to) {
          const bounds = new LngLatBounds();
          for (const p of greatCircle(from, to, 24)) bounds.extend(p);
          map.fitBounds(bounds, { padding: panelPadding(true), maxZoom: 5, duration: animate ? 1400 : 0 });
        } else if (from) {
          map.flyTo({
            center: [from.lon, from.lat],
            zoom: Math.max(map.getZoom(), isDesktop() ? 2.1 : 1.4),
            padding: panelPadding(true),
            duration: animate ? 1600 : 0,
            essential: false,
          });
        }
      }),
    [selected, routeTo],
  );

  return (
    // MapLibre sets `position: relative` on its container, so position a wrapper instead.
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label="World route map. Choose an airport marker to see its routes."
        onKeyDown={(e) => {
          if (e.key === "Escape" && selected) selectAirport(null);
        }}
      />
    </div>
  );
}

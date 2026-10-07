import type { FeatureCollection, LineString, MultiLineString, Position } from "geojson";
import type { StyleSpecification } from "maplibre-gl";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopo from "world-atlas/countries-110m.json";

/**
 * A self-contained basemap: country shapes from world-atlas, drawn with the
 * app's theme colours. No tile server or glyph server is needed, so the map
 * works offline and matches light/dark mode exactly.
 */

export interface MapColors {
  ocean: string;
  land: string;
  border: string;
  graticule: string;
  signal: string;
  foreground: string;
}

/**
 * world-atlas rings are spherical: Russia and Fiji cross the antimeridian and
 * Antarctica wraps the pole. Unwrap longitudes so rings are continuous, and
 * close pole-encircling rings through the pole, for planar rendering.
 */
function fixRing(ring: Position[]): Position[] {
  const out: Position[] = [];
  for (const [lon, lat] of ring) {
    let x = lon;
    if (out.length) {
      const prev = out[out.length - 1][0];
      while (x - prev > 180) x -= 360;
      while (x - prev < -180) x += 360;
    }
    out.push([x, lat]);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (Math.abs(last[0] - first[0]) > 180) {
    const pole = first[1] < 0 ? -90 : 90;
    out.push([last[0], pole], [first[0], pole], first);
  }
  return out;
}

const topology = countriesTopo as unknown as Topology<{ countries: GeometryCollection }>;
const rawCountries = feature(topology, topology.objects.countries);

export const COUNTRIES: typeof rawCountries = {
  ...rawCountries,
  features: rawCountries.features.map((f) => {
    const g = f.geometry;
    if (g.type === "Polygon") {
      return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fixRing) } };
    }
    if (g.type === "MultiPolygon") {
      return { ...f, geometry: { ...g, coordinates: g.coordinates.map((p) => p.map(fixRing)) } };
    }
    return f;
  }),
};

function graticule(step = 30): FeatureCollection<LineString> {
  const lines: [number, number][][] = [];
  for (let lon = -180; lon <= 180; lon += step) {
    lines.push(Array.from({ length: 33 }, (_, i) => [lon, -80 + i * 5] as [number, number]));
  }
  for (let lat = -60; lat <= 60; lat += step) {
    lines.push(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat] as [number, number]));
  }
  return {
    type: "FeatureCollection",
    features: lines.map((coordinates) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    })),
  };
}

export const EMPTY_LINES: FeatureCollection<LineString | MultiLineString> = {
  type: "FeatureCollection",
  features: [],
};

export function buildStyle(colors: MapColors, projection: "globe" | "mercator"): StyleSpecification {
  return {
    version: 8,
    projection: { type: projection },
    sources: {
      countries: { type: "geojson", data: COUNTRIES },
      graticule: { type: "geojson", data: graticule() },
      arcs: { type: "geojson", data: EMPTY_LINES, lineMetrics: true },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": colors.ocean } },
      {
        id: "graticule",
        type: "line",
        source: "graticule",
        paint: { "line-color": colors.graticule, "line-width": 0.6 },
      },
      {
        id: "land",
        type: "fill",
        source: "countries",
        paint: { "fill-color": colors.land },
      },
      {
        id: "borders",
        type: "line",
        source: "countries",
        paint: { "line-color": colors.border, "line-width": 0.6 },
      },
      {
        id: "arcs-base",
        type: "line",
        source: "arcs",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": colors.signal,
          "line-opacity": ["case", ["boolean", ["get", "active"], false], 0.9, ["get", "dim"]],
          "line-width": ["case", ["boolean", ["get", "active"], false], 2.6, 1.3],
        },
      },
      {
        id: "arcs-flow",
        type: "line",
        source: "arcs",
        filter: ["==", ["get", "active"], true],
        layout: { "line-cap": "butt" },
        paint: {
          "line-color": colors.foreground,
          "line-opacity": 0.55,
          "line-width": 1.2,
          "line-dasharray": [0, 4, 3],
        },
      },
    ],
  };
}

/**
 * Resolve CSS colour tokens (oklch) to rgb() strings MapLibre can parse, by
 * painting them on a 1px canvas.
 */
export function readMapColors(el: HTMLElement): MapColors {
  const css = getComputedStyle(el);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const resolve = (name: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css.getPropertyValue(name).trim() || "#888";
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  };
  return {
    ocean: resolve("--map-ocean"),
    land: resolve("--map-land"),
    border: resolve("--map-border"),
    graticule: resolve("--map-graticule"),
    signal: resolve("--signal"),
    foreground: resolve("--foreground"),
  };
}

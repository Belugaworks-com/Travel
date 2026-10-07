// MapLibre locates its web worker relative to its own module URL, which a
// bundler rewrites. Serve the worker from /vendor and point MapLibre at it.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
const target = join(import.meta.dirname, "..", "public", "vendor");
mkdirSync(target, { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), join(target, "maplibre-gl-worker.mjs"));

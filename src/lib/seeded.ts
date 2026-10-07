/** Deterministic hash -> [0, 1). Keeps sample data stable between requests. */
export function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Deterministic value in [min, max). */
export function seededRange(key: string, min: number, max: number) {
  return min + seeded(key) * (max - min);
}

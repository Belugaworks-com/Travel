import { routeKey } from "@/lib/data/network";
import { seededRange } from "@/lib/seeded";
import type { Cabin } from "@/lib/types";

/**
 * Estimated load factors. Airlines don't publish per-flight loads, so this is
 * a model: a route/airline baseline adjusted for day of week and season. Swap
 * in your airline's load data (or a provider feed) behind the same functions.
 */

/** Long-run average load factor for an airline on a route, 0–1. */
export function baselineLoadFactor(from: string, to: string, airline: string) {
  return seededRange(`lf:${airline}:${routeKey(from, to)}`, 0.68, 0.9);
}

const DOW_ADJUST = [0.05, 0.01, -0.06, -0.05, 0.02, 0.07, -0.03]; // Sun..Sat
const MONTH_ADJUST = [-0.05, -0.07, -0.01, 0.01, 0.02, 0.06, 0.09, 0.09, 0.0, -0.01, -0.03, 0.07];

const CABIN_OFFSET: Record<Cabin, number> = {
  economy: 0,
  premium_economy: 0.01,
  // Premium cabins run fuller once upgrades clear, and first is often sold down.
  business: 0.03,
  first: -0.08,
};

export function loadFactorFor(
  from: string,
  to: string,
  airline: string,
  date: Date,
  cabin: Cabin,
) {
  const lf =
    baselineLoadFactor(from, to, airline) +
    DOW_ADJUST[date.getUTCDay()] +
    MONTH_ADJUST[date.getUTCMonth()] +
    CABIN_OFFSET[cabin];
  return Math.min(1.04, Math.max(0.35, lf));
}

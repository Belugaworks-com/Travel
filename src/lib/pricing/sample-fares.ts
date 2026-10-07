import { getAirport } from "@/lib/data/airports";
import { distanceMiles } from "@/lib/geo";
import { seeded, seededRange } from "@/lib/seeded";
import type { Cabin, FareLevel, FareQuote, PriceInsights } from "@/lib/types";

/**
 * Sample fare model used when SerpApi is not configured. It produces stable,
 * plausible one-way fares from distance, cabin, route demand and date, so the
 * UI and the staff travel engine have realistic inputs to work with. It is not
 * a price source and the UI labels it as sample data.
 */

const CABIN_MULTIPLIER: Record<Cabin, number> = {
  economy: 1,
  premium_economy: 1.7,
  business: 4.3,
  first: 7.2,
};

/** Carrier surcharge (YQ/YR) in USD per 1,000 miles, capped below. */
const SURCHARGE_PER_1000_MI: Record<string, number> = {
  BA: 62, LH: 55, AF: 48, KL: 48, IB: 45, EI: 30, CX: 32, EK: 28, QR: 26,
  SQ: 18, NH: 20, JL: 20, QF: 34, TK: 22, AC: 30,
};

const US = "United States";

export function routeDistance(from: string, to: string) {
  const a = getAirport(from);
  const b = getAirport(to);
  if (!a || !b) throw new Error(`Unknown airport ${!a ? from : to}`);
  return distanceMiles(a, b);
}

/** The route's typical published one-way base fare, before taxes. */
export function typicalBaseFare(from: string, to: string, cabin: Cabin) {
  const miles = routeDistance(from, to);
  const demand = seededRange(`demand:${[from, to].sort().join("-")}`, 0.85, 1.3);
  const economy = (55 + miles * 0.105) * demand;
  return economy * CABIN_MULTIPLIER[cabin];
}

function dayVariation(from: string, to: string, date: Date) {
  const dow = date.getUTCDay();
  const month = date.getUTCMonth();
  const weekday = [1.08, 0.95, 0.9, 0.92, 1.05, 1.14, 0.98][dow];
  const season = [0.92, 0.88, 0.95, 1.02, 1.04, 1.14, 1.22, 1.2, 1.0, 0.96, 0.95, 1.18][month];
  const iso = date.toISOString().slice(0, 10);
  const noise = seededRange(`fare:${from}-${to}:${iso}`, 0.78, 1.25);
  return weekday * season * noise;
}

export function sampleFareQuote(
  from: string,
  to: string,
  cabin: Cabin,
  date: Date,
  airline?: string,
): FareQuote {
  const miles = routeDistance(from, to);
  const carrierFactor = airline
    ? seededRange(`carrier:${airline}:${[from, to].sort().join("-")}`, 0.9, 1.14)
    : 1;
  const baseFare = typicalBaseFare(from, to, cabin) * dayVariation(from, to, date) * carrierFactor;

  const origin = getAirport(from)!;
  const dest = getAirport(to)!;
  const longHaul = miles > 2000;
  const premium = cabin !== "economy";
  let governmentTaxes = 22;
  if (origin.country === "United Kingdom") {
    governmentTaxes += longHaul ? (premium ? 260 : 110) : premium ? 38 : 17;
  }
  if (origin.country === US || dest.country === US) governmentTaxes += 46;
  governmentTaxes += longHaul ? 48 : 18;

  const domesticUs = origin.country === US && dest.country === US;
  const rate = domesticUs ? 0 : (SURCHARGE_PER_1000_MI[airline ?? ""] ?? 20);
  const carrierSurcharge = Math.min(480, (miles / 1000) * rate * (premium ? 1.6 : 1));

  return {
    baseFare: Math.round(baseFare),
    governmentTaxes: Math.round(governmentTaxes),
    carrierSurcharge: Math.round(carrierSurcharge),
    currency: "USD",
  };
}

/**
 * Split an all-in price into base fare, taxes and surcharge. Google Flights
 * only returns the total, so taxes are estimated per segment from the route
 * model and the remainder is treated as base fare (what staff discounts apply to).
 */
export function splitFare(
  total: number,
  segments: { from: string; to: string; airline: string }[],
  cabin: Cabin,
  date: Date,
): FareQuote {
  let governmentTaxes = 0;
  let carrierSurcharge = 0;
  for (const s of segments) {
    const q = sampleFareQuote(s.from, s.to, cabin, date, s.airline);
    governmentTaxes += q.governmentTaxes;
    carrierSurcharge += q.carrierSurcharge;
  }
  // Never let estimated taxes exceed the price itself.
  const scale = Math.min(1, (total * 0.85) / Math.max(1, governmentTaxes + carrierSurcharge));
  governmentTaxes = Math.round(governmentTaxes * scale);
  carrierSurcharge = Math.round(carrierSurcharge * scale);
  return {
    baseFare: Math.max(0, total - governmentTaxes - carrierSurcharge),
    governmentTaxes,
    carrierSurcharge,
    currency: "USD",
  };
}

export function quoteTotal(q: FareQuote) {
  return q.baseFare + q.governmentTaxes + q.carrierSurcharge;
}

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Classify a price against the route's typical range (25th–75th percentile). */
export function classifyFare(price: number, typicalRange: [number, number]): FareLevel {
  if (price <= typicalRange[0]) return "cheap";
  if (price >= typicalRange[1]) return "high";
  return "average";
}

/**
 * Sample price insights for a departure date: what this route has been
 * priced at over the previous 60 days, and where the given date sits.
 */
export function samplePriceInsights(
  from: string,
  to: string,
  cabin: Cabin,
  date: Date,
  airline?: string,
): PriceInsights {
  const history: [number, number][] = [];
  const DAY = 86_400_000;
  for (let i = 60; i >= 1; i--) {
    const d = new Date(date.getTime() - i * DAY);
    history.push([Math.floor(d.getTime() / 1000), quoteTotal(sampleFareQuote(from, to, cabin, d, airline))]);
  }
  const prices = history.map(([, p]) => p).sort((a, b) => a - b);
  const typicalRange: [number, number] = [
    Math.round(quantile(prices, 0.25)),
    Math.round(quantile(prices, 0.75)),
  ];
  const current = quoteTotal(sampleFareQuote(from, to, cabin, date, airline));
  return {
    lowestPrice: Math.min(current, prices[0]),
    typicalRange,
    level: classifyFare(current, typicalRange),
    history,
  };
}

/** Stable sample flight number for an airline on a route. */
export function sampleFlightNumber(airline: string, from: string, to: string) {
  const n = Math.floor(seeded(`fn:${airline}:${from}-${to}`) * 980) + 10;
  return `${airline}${n}`;
}

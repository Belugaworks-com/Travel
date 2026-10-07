import "server-only";

import { getAirport } from "@/lib/data/airports";
import {
  getConnectingDestinations,
  getConnectingHubs,
  getDirectDestinations,
  getOperations,
} from "@/lib/data/network";
import {
  quoteTotal,
  routeDistance,
  sampleFareQuote,
  samplePriceInsights,
} from "@/lib/pricing/sample-fares";
import type { Cabin, DataSource, FareLevel, FareQuote } from "@/lib/types";

export interface DestinationSummary {
  iata: string;
  city: string;
  country: string;
  distanceMiles: number;
  /** Carriers on the nonstop, or the hubs for one-stop destinations. */
  carriers: string[];
  via: string[];
  /** Cheapest estimated one-way fare on the given date. */
  fare: FareQuote;
  level: FareLevel;
  typicalRange: [number, number];
}

export interface DestinationsResult {
  origin: string;
  direction: "outbound" | "inbound";
  date: string;
  /** Overview fares are always modelled; live prices load per route. */
  source: DataSource;
  nonstop: DestinationSummary[];
  oneStop: DestinationSummary[];
}

function cheapest(from: string, to: string, airlines: string[], cabin: Cabin, date: Date) {
  let best: { fare: FareQuote; airline: string } | null = null;
  for (const airline of airlines) {
    const fare = sampleFareQuote(from, to, cabin, date, airline);
    if (!best || quoteTotal(fare) < quoteTotal(best.fare)) best = { fare, airline };
  }
  return best!;
}

function summarize(
  origin: string,
  other: string,
  direction: "outbound" | "inbound",
  cabin: Cabin,
  date: Date,
): DestinationSummary {
  const [from, to] = direction === "outbound" ? [origin, other] : [other, origin];
  const airport = getAirport(other)!;
  const direct = getOperations(from, to).map((op) => op.airline);
  const via = direct.length ? [] : getConnectingHubs(from, to).slice(0, 3);

  // One-stop: price via the best hub as a through fare (sum of legs, discounted).
  let fare: FareQuote;
  let airline: string;
  if (direct.length) {
    ({ fare, airline } = cheapest(from, to, direct, cabin, date));
  } else {
    const hub = via[0];
    const a = cheapest(from, hub, getOperations(from, hub).map((op) => op.airline), cabin, date);
    const b = cheapest(hub, to, getOperations(hub, to).map((op) => op.airline), cabin, date);
    fare = {
      baseFare: Math.round(0.82 * (a.fare.baseFare + b.fare.baseFare)),
      governmentTaxes: a.fare.governmentTaxes + b.fare.governmentTaxes,
      carrierSurcharge: a.fare.carrierSurcharge + b.fare.carrierSurcharge,
      currency: "USD",
    };
    airline = a.airline;
  }
  const insights = samplePriceInsights(from, to, cabin, date, airline);
  const total = quoteTotal(fare);
  const scale = direct.length ? 1 : total / quoteTotal(sampleFareQuote(from, to, cabin, date, airline));

  return {
    iata: other,
    city: airport.city,
    country: airport.country,
    distanceMiles: Math.round(routeDistance(from, to)),
    carriers: direct,
    via,
    fare,
    level: direct.length
      ? insights.level
      : total <= insights.typicalRange[0] * scale
        ? "cheap"
        : total >= insights.typicalRange[1] * scale
          ? "high"
          : "average",
    typicalRange: [
      Math.round(insights.typicalRange[0] * scale),
      Math.round(insights.typicalRange[1] * scale),
    ],
  };
}

export function getDestinations(
  origin: string,
  direction: "outbound" | "inbound",
  cabin: Cabin,
  date: Date,
): DestinationsResult {
  const byFare = (a: DestinationSummary, b: DestinationSummary) =>
    quoteTotal(a.fare) - quoteTotal(b.fare);
  return {
    origin,
    direction,
    date: date.toISOString().slice(0, 10),
    source: "sample",
    nonstop: getDirectDestinations(origin)
      .map((d) => summarize(origin, d, direction, cabin, date))
      .sort(byFare),
    oneStop: getConnectingDestinations(origin)
      .map((d) => summarize(origin, d, direction, cabin, date))
      .sort(byFare),
  };
}

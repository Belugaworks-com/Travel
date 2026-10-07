import "server-only";

import type { FlightSearchQuery } from "@/lib/api/schemas";
import { getAirline, getConnectingHubs, getOperations } from "@/lib/data/network";
import {
  classifyFare,
  quoteTotal,
  routeDistance,
  sampleFareQuote,
  splitFare,
  sampleFlightNumber,
  samplePriceInsights,
} from "@/lib/pricing/sample-fares";
import { seeded } from "@/lib/seeded";
import type {
  Cabin,
  FareLevel,
  FlightOffer,
  FlightSearchResult,
  FlightSegment,
  PriceInsights,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// SerpApi (Google Flights engine)
// ---------------------------------------------------------------------------

const TRAVEL_CLASS: Record<Cabin, string> = {
  economy: "1",
  premium_economy: "2",
  business: "3",
  first: "4",
};

interface SerpAirport {
  id: string;
  name?: string;
  time: string;
}

interface SerpFlight {
  departure_airport: SerpAirport;
  arrival_airport: SerpAirport;
  duration: number;
  airplane?: string;
  airline: string;
  flight_number: string;
}

interface SerpItinerary {
  flights: SerpFlight[];
  layovers?: { duration: number; id: string }[];
  total_duration: number;
  price?: number;
  booking_token?: string;
}

interface SerpResponse {
  error?: string;
  best_flights?: SerpItinerary[];
  other_flights?: SerpItinerary[];
  price_insights?: {
    lowest_price: number;
    price_level?: "low" | "typical" | "high";
    typical_price_range?: [number, number];
    price_history?: [number, number][];
  };
}

/** SerpApi reports times as "2026-11-02 08:15" in local airport time. */
const serpTime = (t: string) => t.replace(" ", "T");

function normalizeSerp(body: SerpResponse, cabin: Cabin, date: Date): FlightSearchResult {
  const itineraries = [...(body.best_flights ?? []), ...(body.other_flights ?? [])];
  const offers: FlightOffer[] = itineraries
    .filter((it) => typeof it.price === "number")
    .map((it, i) => ({
      id: it.booking_token ?? `serp-${i}`,
      segments: it.flights.map((f) => {
        const code = f.flight_number.split(" ")[0];
        return {
          from: f.departure_airport.id,
          to: f.arrival_airport.id,
          airline: code,
          airlineName: f.airline,
          flightNumber: f.flight_number.replace(" ", ""),
          aircraft: f.airplane ?? "Not published",
          departAt: serpTime(f.departure_airport.time),
          arriveAt: serpTime(f.arrival_airport.time),
          durationMinutes: f.duration,
        };
      }),
      layovers: (it.layovers ?? []).map((l) => ({ airport: l.id, durationMinutes: l.duration })),
      totalDurationMinutes: it.total_duration,
      cabin,
      price: it.price!,
      currency: "USD",
      fare: splitFare(
        it.price!,
        it.flights.map((f) => ({
          from: f.departure_airport.id,
          to: f.arrival_airport.id,
          airline: f.flight_number.split(" ")[0],
        })),
        cabin,
        date,
      ),
      bookingToken: it.booking_token,
    }));

  const pi = body.price_insights;
  let insights: PriceInsights | null = null;
  if (pi) {
    const range = pi.typical_price_range ?? [pi.lowest_price, pi.lowest_price];
    const level: FareLevel =
      pi.price_level === "low"
        ? "cheap"
        : pi.price_level === "high"
          ? "high"
          : pi.price_level === "typical"
            ? "average"
            : classifyFare(pi.lowest_price, range);
    insights = {
      lowestPrice: pi.lowest_price,
      typicalRange: range,
      level,
      history: pi.price_history ?? [],
    };
  }
  return { source: "live", offers, insights };
}

async function searchSerpApi(q: FlightSearchQuery): Promise<FlightSearchResult | null> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return null;
  const url = new URL("https://serpapi.com/search.json");
  const params: Record<string, string | undefined> = {
    engine: "google_flights",
    departure_id: q.from,
    arrival_id: q.to,
    outbound_date: q.date,
    type: "2", // one way
    travel_class: TRAVEL_CLASS[q.cabin],
    currency: "USD",
    hl: "en",
    adults: "1",
    // SerpApi stops: 0 any, 1 nonstop, 2 ≤1 stop, 3 ≤2 stops
    stops: q.maxStops === undefined ? undefined : String(q.maxStops + 1),
    include_airlines: q.airline,
    max_price: q.maxPrice ? String(Math.floor(q.maxPrice)) : undefined,
    api_key: key,
  };
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as SerpResponse;
    if (body.error) return null;
    return normalizeSerp(body, q.cabin, new Date(`${q.date}T00:00:00Z`));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sample search (no API key, or SerpApi unreachable)
// ---------------------------------------------------------------------------

const CRUISE_MPH = 490;
const TAXI_MINUTES = 35;

function sampleSegment(airline: string, aircraft: string, from: string, to: string, depart: Date): FlightSegment {
  const minutes = Math.round((routeDistance(from, to) / CRUISE_MPH) * 60 + TAXI_MINUTES);
  const arrive = new Date(depart.getTime() + minutes * 60_000);
  return {
    from,
    to,
    airline,
    airlineName: getAirline(airline)?.name ?? airline,
    flightNumber: sampleFlightNumber(airline, from, to),
    aircraft,
    // Sample times are expressed in UTC; live SerpApi results use local times.
    departAt: depart.toISOString().slice(0, 16),
    arriveAt: arrive.toISOString().slice(0, 16),
    durationMinutes: minutes,
  };
}

function departureTime(date: string, key: string) {
  const hour = 6 + Math.floor(seeded(key) * 16);
  const minute = Math.floor(seeded(`${key}:m`) * 12) * 5;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
}

function sampleSearch(q: FlightSearchQuery): FlightSearchResult {
  const day = new Date(`${q.date}T00:00:00Z`);
  const offers: FlightOffer[] = [];

  for (const op of getOperations(q.from, q.to)) {
    const seg = sampleSegment(op.airline, op.aircraft, q.from, q.to, departureTime(q.date, `${op.airline}${q.from}${q.to}`));
    const fare = sampleFareQuote(q.from, q.to, q.cabin, day, op.airline);
    offers.push({
      id: `sample-${seg.flightNumber}-${q.date}`,
      segments: [seg],
      layovers: [],
      totalDurationMinutes: seg.durationMinutes,
      cabin: q.cabin,
      price: quoteTotal(fare),
      currency: "USD",
      fare,
    });
  }

  for (const via of getConnectingHubs(q.from, q.to).slice(0, 4)) {
    const leg1 = getOperations(q.from, via)[0];
    // Prefer staying on one airline (or its hub carrier) for the second leg.
    const leg2 =
      getOperations(via, q.to).find((op) => op.airline === leg1.airline) ??
      getOperations(via, q.to)[0];
    const s1 = sampleSegment(leg1.airline, leg1.aircraft, q.from, via, departureTime(q.date, `${leg1.airline}${q.from}${via}`));
    const connect = 70 + Math.floor(seeded(`cx:${via}:${q.date}`) * 160);
    const s2 = sampleSegment(leg2.airline, leg2.aircraft, via, q.to, new Date(new Date(`${s1.arriveAt}:00Z`).getTime() + connect * 60_000));
    // Connecting fares price as a through fare, a little below the sum of legs.
    const price = Math.round(
      0.82 *
        (quoteTotal(sampleFareQuote(q.from, via, q.cabin, day, leg1.airline)) +
          quoteTotal(sampleFareQuote(via, q.to, q.cabin, day, leg2.airline))),
    );
    offers.push({
      id: `sample-${s1.flightNumber}-${s2.flightNumber}-${q.date}`,
      segments: [s1, s2],
      layovers: [{ airport: via, durationMinutes: connect }],
      totalDurationMinutes: s1.durationMinutes + connect + s2.durationMinutes,
      cabin: q.cabin,
      price,
      currency: "USD",
      fare: splitFare(price, [s1, s2], q.cabin, day),
    });
  }

  const insights =
    offers.length > 0
      ? samplePriceInsights(q.from, q.to, q.cabin, day, offers[0].segments[0].airline)
      : null;
  return { source: "sample", offers, insights };
}

// ---------------------------------------------------------------------------

function applyFilters(result: FlightSearchResult, q: FlightSearchQuery): FlightSearchResult {
  const offers = result.offers
    .filter((o) => q.maxStops === undefined || o.layovers.length <= q.maxStops)
    .filter((o) => !q.airline || o.segments.some((s) => s.airline === q.airline))
    .filter((o) => !q.maxPrice || o.price <= q.maxPrice)
    .filter(
      (o) =>
        !q.maxLayoverMinutes ||
        o.layovers.every((l) => l.durationMinutes <= q.maxLayoverMinutes!),
    )
    .sort((a, b) => a.price - b.price);
  return { ...result, offers };
}

export async function searchFlights(q: FlightSearchQuery): Promise<FlightSearchResult> {
  const live = await searchSerpApi(q);
  if (live) return applyFilters(live, q);

  // Sample insights describe the route; grade them against the cheapest offer shown.
  const result = applyFilters(sampleSearch(q), q);
  const cheapest = result.offers[0];
  if (result.insights && cheapest) {
    result.insights = {
      ...result.insights,
      lowestPrice: Math.min(result.insights.lowestPrice, cheapest.price),
      level: classifyFare(cheapest.price, result.insights.typicalRange),
    };
  }
  return result;
}

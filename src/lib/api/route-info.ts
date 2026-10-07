import "server-only";

import { cacheLife } from "next/cache";

import { getAircraft } from "@/lib/data/aircraft";
import { getAirport } from "@/lib/data/airports";
import {
  getAirline,
  getConnectingHubs,
  getOperations,
} from "@/lib/data/network";
import { distanceMiles } from "@/lib/geo";
import { loadFactorFor } from "@/lib/loads";
import { sampleFlightNumber } from "@/lib/pricing/sample-fares";
import { standbyOdds } from "@/lib/staff-travel/engine";
import type { Alliance, Cabin, CabinConfig, DataSource } from "@/lib/types";
import { CABINS } from "@/lib/types";

export interface RouteOperator {
  airline: string;
  airlineName: string;
  alliance: Alliance;
  flightNumber: string;
  aircraft: string;
  widebody: boolean;
  config: CabinConfig | null;
  loadFactor: Record<Cabin, number>;
  /** Economy standby odds for an own-airline employee, 0–1. */
  standbyOdds: number | null;
}

export interface RouteInfo {
  from: string;
  to: string;
  date: string;
  distanceMiles: number;
  /** Where operating carriers came from; loads and configs are always modelled. */
  source: DataSource;
  operators: RouteOperator[];
  /** One-stop hubs, best connected first. Populated when there is no nonstop. */
  connections: { via: string; carriers: string[] }[];
  typicalLoadFactor: number | null;
  standbyScore: number | null;
}

interface LiveCarrier {
  airline: string;
  airlineName: string;
  flightNumber: string;
}

interface AviationstackFlight {
  airline?: { iata?: string | null; name?: string | null } | null;
  flight?: {
    iata?: string | null;
    codeshared?: { airline_iata?: string; airline_name?: string; flight_iata?: string } | null;
  } | null;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Airlines operating a route, from Aviationstack's flights endpoint (the
 * routes endpoint needs a paid plan). Codeshares are folded into the
 * operating carrier. Cached for a day because the free plan allows about 100
 * requests a month; throws on failure so errors are never cached.
 */
async function fetchOperatingCarriers(from: string, to: string): Promise<LiveCarrier[]> {
  "use cache";
  cacheLife("days");

  const url = new URL("https://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", process.env.AVIATIONSTACK_API_KEY ?? "");
  url.searchParams.set("dep_iata", from);
  url.searchParams.set("arr_iata", to);
  url.searchParams.set("limit", "100");
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const body = (await res.json()) as { data?: AviationstackFlight[]; error?: { code?: string } };
  if (!res.ok || body.error || !body.data) {
    throw new Error(`Aviationstack: ${body.error?.code ?? res.status}`);
  }

  const carriers = new Map<string, LiveCarrier & { flights: number }>();
  for (const row of body.data) {
    const cs = row.flight?.codeshared;
    const code = (cs?.airline_iata ?? row.airline?.iata ?? "").toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(code)) continue;
    const name = cs?.airline_name ?? row.airline?.name ?? code;
    const flightNumber = (cs?.flight_iata ?? row.flight?.iata ?? code).toUpperCase();
    const entry = carriers.get(code);
    if (entry) entry.flights++;
    else carriers.set(code, { airline: code, airlineName: titleCase(name), flightNumber, flights: 1 });
  }
  return [...carriers.values()]
    .sort((a, b) => b.flights - a.flights)
    .map(({ airline, airlineName, flightNumber }) => ({ airline, airlineName, flightNumber }));
}

/** Live carriers, or null without a key or when the request fails. */
async function fetchLiveCarriers(from: string, to: string): Promise<LiveCarrier[] | null> {
  if (!process.env.AVIATIONSTACK_API_KEY) return null;
  try {
    return await fetchOperatingCarriers(from, to);
  } catch {
    return null;
  }
}

export async function getRouteInfo(from: string, to: string, date: Date): Promise<RouteInfo> {
  const a = getAirport(from);
  const b = getAirport(to);
  if (!a || !b) throw new Error("Unknown airport");

  const sampleOps = getOperations(from, to);
  const live = await fetchLiveCarriers(from, to);
  const source: DataSource = live && live.length > 0 ? "live" : "sample";

  const carriers =
    source === "live"
      ? live!.map((c) => ({
          ...c,
          aircraft: sampleOps.find((op) => op.airline === c.airline)?.aircraft ?? null,
        }))
      : sampleOps.map((op) => ({
          airline: op.airline,
          airlineName: getAirline(op.airline)?.name ?? op.airline,
          flightNumber: sampleFlightNumber(op.airline, from, to),
          aircraft: op.aircraft,
        }));

  const operators: RouteOperator[] = carriers.map((c) => {
    const aircraft = c.aircraft ? getAircraft(c.aircraft) : undefined;
    const loadFactor = Object.fromEntries(
      CABINS.map((cabin) => [cabin, loadFactorFor(from, to, c.airline, date, cabin)]),
    ) as Record<Cabin, number>;
    const odds = aircraft
      ? standbyOdds({ config: aircraft.config, loadFactor, tier: 2 }).economy
      : null;
    return {
      airline: c.airline,
      airlineName: getAirline(c.airline)?.name ?? c.airlineName,
      alliance: getAirline(c.airline)?.alliance ?? "none",
      flightNumber: c.flightNumber,
      aircraft: c.aircraft ?? "Not published",
      widebody: aircraft?.widebody ?? false,
      config: aircraft?.config ?? null,
      loadFactor,
      standbyOdds: odds,
    };
  });

  const connections =
    operators.length === 0
      ? getConnectingHubs(from, to)
          .slice(0, 4)
          .map((via) => ({
            via,
            carriers: [
              ...new Set([
                ...getOperations(from, via).map((op) => op.airline),
                ...getOperations(via, to).map((op) => op.airline),
              ]),
            ],
          }))
      : [];

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const odds = operators.map((op) => op.standbyOdds).filter((x): x is number => x !== null);

  return {
    from,
    to,
    date: date.toISOString().slice(0, 10),
    distanceMiles: Math.round(distanceMiles(a, b)),
    source,
    operators,
    connections,
    typicalLoadFactor: avg(operators.map((op) => op.loadFactor.economy)),
    standbyScore: avg(odds),
  };
}

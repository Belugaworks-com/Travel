import "server-only";

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

/**
 * Operating carriers from Aviationstack's routes endpoint. Returns null when
 * no key is configured or the request fails, so callers fall back to sample.
 */
async function fetchLiveCarriers(from: string, to: string): Promise<LiveCarrier[] | null> {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) return null;
  const url = new URL("https://api.aviationstack.com/v1/routes");
  url.searchParams.set("access_key", key);
  url.searchParams.set("dep_iata", from);
  url.searchParams.set("arr_iata", to);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { airline?: { iata?: string; name?: string }; flight?: { number?: string } }[];
    };
    const seen = new Set<string>();
    const carriers: LiveCarrier[] = [];
    for (const row of body.data ?? []) {
      const code = row.airline?.iata;
      if (!code || seen.has(code)) continue;
      seen.add(code);
      carriers.push({
        airline: code,
        airlineName: row.airline?.name ?? code,
        flightNumber: `${code}${row.flight?.number ?? ""}`,
      });
    }
    return carriers;
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
      airlineName: c.airlineName,
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

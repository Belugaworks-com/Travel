import { getAirport } from "@/lib/data/airports";
import { distanceMiles } from "@/lib/geo";
import type { Airline } from "@/lib/types";

/**
 * Sample route network: which airline flies which airport pair, on what
 * aircraft. It stands in for a schedules API (Aviationstack / FlightAware)
 * until one is connected, and is representative rather than a live timetable.
 */

export const AIRLINES: Airline[] = [
  { code: "BA", name: "British Airways", alliance: "oneworld" },
  { code: "AA", name: "American Airlines", alliance: "oneworld" },
  { code: "IB", name: "Iberia", alliance: "oneworld" },
  { code: "QR", name: "Qatar Airways", alliance: "oneworld" },
  { code: "CX", name: "Cathay Pacific", alliance: "oneworld" },
  { code: "JL", name: "Japan Airlines", alliance: "oneworld" },
  { code: "QF", name: "Qantas", alliance: "oneworld" },
  { code: "UA", name: "United Airlines", alliance: "star" },
  { code: "LH", name: "Lufthansa", alliance: "star" },
  { code: "AC", name: "Air Canada", alliance: "star" },
  { code: "SQ", name: "Singapore Airlines", alliance: "star" },
  { code: "NH", name: "ANA", alliance: "star" },
  { code: "TK", name: "Turkish Airlines", alliance: "star" },
  { code: "DL", name: "Delta Air Lines", alliance: "skyteam" },
  { code: "AF", name: "Air France", alliance: "skyteam" },
  { code: "KL", name: "KLM", alliance: "skyteam" },
  { code: "EK", name: "Emirates", alliance: "none" },
  { code: "EI", name: "Aer Lingus", alliance: "none" },
];

const AIRCRAFT_CODES: Record<string, string> = {
  "388": "Airbus A380-800",
  "35K": "Airbus A350-1000",
  "359": "Airbus A350-900",
  "35U": "Airbus A350-900ULR",
  "343": "Airbus A340-300",
  "339": "Airbus A330-900",
  "333": "Airbus A330-300",
  "332": "Airbus A330-200",
  "748": "Boeing 747-8",
  "77W": "Boeing 777-300ER",
  "77L": "Boeing 777-200LR",
  "77E": "Boeing 777-200ER",
  "772": "Boeing 777-200",
  "78X": "Boeing 787-10",
  "789": "Boeing 787-9",
  "788": "Boeing 787-8",
  "764": "Boeing 767-400ER",
  "763": "Boeing 767-300ER",
  "32X": "Airbus A321XLR",
  "32T": "Airbus A321T",
  "32N": "Airbus A321neo",
  "321": "Airbus A321",
  "20N": "Airbus A320neo",
  "320": "Airbus A320",
  "223": "Airbus A220-300",
  "752": "Boeing 757-200",
  "739": "Boeing 737-900ER",
  "738": "Boeing 737-800",
  "7M9": "Boeing 737 MAX 9",
  "7M8": "Boeing 737 MAX 8",
  "295": "Embraer E195-E2",
  E75: "Embraer E175",
};

/** airline -> hub -> "DEST:aircraft DEST:aircraft ..." */
const HUB_ROUTES: Record<string, Record<string, string>> = {
  BA: {
    LHR: "JFK:77E BOS:789 ORD:78X LAX:388 SFO:35K MIA:77E SEA:789 DFW:789 YYZ:788 GRU:77E MEX:788 SIN:77W HKG:35K HND:77W DEL:78X JNB:35K CPT:789 DXB:388 MAD:20N CDG:20N FRA:20N MUC:20N AMS:20N LIS:20N FCO:32N BCN:20N DUB:20N ZRH:20N IST:32N",
  },
  AA: {
    DFW: "LHR:77E ORD:321 LAX:321 SFO:321 MIA:321 JFK:321 ATL:321 BOS:321 SEA:738 MEX:7M8 GRU:789 HND:788 HNL:32N",
    JFK: "LHR:77W MAD:77E BCN:77E LAX:32T SFO:32T MIA:321",
    MIA: "GRU:77E MEX:321 MAD:789 LHR:77W",
  },
  IB: {
    MAD: "JFK:359 BOS:332 ORD:332 MIA:359 MEX:359 GRU:359 LHR:20N CDG:20N FRA:20N AMS:20N MUC:20N BCN:32N LIS:20N FCO:20N DUB:20N ZRH:20N",
  },
  QR: {
    DOH: "LHR:35K CDG:388 FRA:359 AMS:789 MAD:359 MUC:359 FCO:359 BCN:788 LIS:788 DUB:789 ZRH:359 IST:788 JFK:77W BOS:789 DFW:77W ATL:77W LAX:77W SFO:77L SEA:77W MIA:77W GRU:77W SIN:35K HKG:35K HND:77W ICN:359 SYD:388 BKK:77W DEL:788 JNB:35K CPT:789",
  },
  CX: {
    HKG: "LHR:77W CDG:359 FRA:359 AMS:359 ZRH:359 DUB:359 JFK:77W BOS:35K LAX:77W SFO:77W SEA:359 DFW:35K YYZ:77W SIN:359 HND:359 ICN:32N SYD:359 AKL:77W BKK:333 DEL:359 DXB:77W",
  },
  JL: {
    HND: "LHR:77W CDG:35K JFK:35K BOS:789 ORD:789 DFW:789 LAX:789 SFO:789 SEA:788 HNL:763 SIN:789 HKG:738 ICN:763 BKK:789 SYD:789 DEL:788",
  },
  QF: {
    SYD: "LAX:388 SFO:789 DFW:388 HNL:333 SIN:388 HKG:333 HND:333 AKL:738 DEL:789 JNB:789",
  },
  UA: {
    SFO: "SIN:789 HKG:77W HND:789 ICN:78X SYD:789 AKL:789 FRA:78X LHR:772 MUC:789 HNL:772 ORD:32N BOS:7M9 JFK:752 LAX:738 SEA:739 MEX:7M9",
    ORD: "LHR:78X FRA:789 MUC:788 ZRH:788 AMS:764 HND:78X BOS:320 LAX:7M9 MIA:739 ATL:320 YYZ:E75 MEX:7M8 SEA:739",
  },
  LH: {
    FRA: "JFK:748 ORD:748 BOS:343 SFO:359 LAX:748 MIA:343 ATL:333 DFW:333 YYZ:333 GRU:748 MEX:748 SIN:359 HKG:359 HND:748 ICN:748 BKK:789 DEL:359 DXB:321 IST:32N JNB:748 CPT:343 LHR:32N CDG:20N AMS:20N MAD:32N BCN:20N LIS:32N FCO:20N DUB:20N ZRH:20N MUC:32N",
    MUC: "JFK:359 BOS:359 ORD:359 LAX:359 SFO:359 SIN:359 HND:359 BKK:359 DEL:359 LHR:20N CDG:20N MAD:20N BCN:20N FCO:20N LIS:20N IST:20N AMS:20N",
  },
  AC: {
    YYZ: "LHR:789 CDG:789 FRA:789 MUC:333 BCN:789 LIS:333 FCO:789 DUB:333 ZRH:333 DEL:77W HND:789 ICN:789 HKG:77W JFK:223 BOS:223 ORD:223 LAX:321 SFO:223 MIA:321 MEX:7M8 GRU:789",
  },
  SQ: {
    SIN: "LHR:388 CDG:359 FRA:388 AMS:359 MUC:359 BCN:359 FCO:359 ZRH:77W JFK:35U LAX:359 SFO:359 SEA:359 HKG:359 HND:78X ICN:78X SYD:388 AKL:78X BKK:78X DEL:78X JNB:78X DXB:77W",
  },
  NH: {
    HND: "LHR:77W FRA:789 MUC:789 JFK:77W ORD:77W LAX:77W SFO:789 SEA:789 HNL:789 SIN:789 HKG:788 BKK:789 SYD:789 DEL:788",
  },
  TK: {
    IST: "LHR:32N CDG:32N FRA:32N AMS:32N MAD:32N MUC:32N BCN:32N FCO:32N LIS:32N DUB:32N ZRH:32N JFK:77W BOS:359 ORD:77W ATL:359 DFW:789 LAX:77W SFO:77W SEA:359 MIA:359 YYZ:789 MEX:789 GRU:77W SIN:359 HKG:359 HND:77W ICN:359 BKK:77W DEL:32N DXB:32N DOH:32N JNB:359 CPT:359",
  },
  DL: {
    ATL: "LHR:339 CDG:359 AMS:359 JFK:321 LAX:321 SFO:321 BOS:321 MIA:739 ORD:739 MEX:739 GRU:339 ICN:359 JNB:359 HND:359 DFW:739 SEA:32N",
    JFK: "LHR:339 CDG:333 FCO:339 BCN:333 LIS:763 DUB:763 ZRH:763 LAX:321 SFO:321 SEA:32N MEX:739",
    SEA: "ICN:339 HND:339 AMS:339 LHR:339 HNL:32N LAX:32N",
    LAX: "SYD:359 HNL:32N",
  },
  AF: {
    CDG: "JFK:77W BOS:359 ATL:359 LAX:77W SFO:77W MIA:359 YYZ:789 MEX:77W GRU:77W SIN:77W HND:77W ICN:789 BKK:789 DEL:789 DXB:77E JNB:77E CPT:359 IST:20N LHR:20N AMS:223 MAD:20N BCN:20N LIS:20N FCO:223 ZRH:223 DUB:223",
  },
  KL: {
    AMS: "JFK:77E BOS:333 ATL:333 ORD:789 LAX:78X SFO:789 MIA:789 YYZ:78X MEX:789 GRU:77W SIN:789 ICN:789 DEL:789 DXB:77E JNB:78X CPT:77W LHR:738 CDG:738 MAD:738 BCN:738 LIS:738 FCO:738 DUB:295 ZRH:295 IST:738",
  },
  EK: {
    DXB: "LHR:388 CDG:388 FRA:388 AMS:77W MAD:77W MUC:388 IST:77W FCO:77W BCN:388 LIS:77W DUB:77W ZRH:77W JFK:388 BOS:77W ORD:77W DFW:388 LAX:388 SFO:388 SEA:77W MIA:77W YYZ:77W GRU:77W SIN:388 HKG:77W HND:77W ICN:388 SYD:388 AKL:388 BKK:388 DEL:77W JNB:388 CPT:77W DOH:77W",
  },
  EI: {
    DUB: "JFK:333 BOS:32X ORD:333 LAX:333 SFO:333 SEA:333 MIA:333 YYZ:32N LHR:320 CDG:320 FRA:320 AMS:320 MAD:320 BCN:320 LIS:320 FCO:320 ZRH:320 MUC:320",
  },
};

export interface RouteOperation {
  airline: string;
  aircraft: string;
  /** The hub end of the route; useful for flight-number generation. */
  hub: string;
}

/** Undirected route key, e.g. "JFK-LHR" (sorted). */
export function routeKey(a: string, b: string) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function buildNetwork() {
  const routes = new Map<string, RouteOperation[]>();
  const neighbours = new Map<string, Set<string>>();

  const link = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };

  for (const [airline, hubs] of Object.entries(HUB_ROUTES)) {
    for (const [hub, list] of Object.entries(hubs)) {
      for (const entry of list.split(" ")) {
        const [dest, code] = entry.split(":");
        const aircraft = AIRCRAFT_CODES[code];
        if (!aircraft) throw new Error(`Unknown aircraft code ${code}`);
        const key = routeKey(hub, dest);
        const ops = routes.get(key) ?? [];
        if (!ops.some((op) => op.airline === airline)) {
          ops.push({ airline, aircraft, hub });
        }
        routes.set(key, ops);
        link(hub, dest);
        link(dest, hub);
      }
    }
  }
  return { routes, neighbours };
}

const NETWORK = buildNetwork();

const airlinesByCode = new Map(AIRLINES.map((a) => [a.code, a]));

export function getAirline(code: string) {
  return airlinesByCode.get(code);
}

/** Airlines operating a nonstop between two airports (either direction). */
export function getOperations(a: string, b: string): RouteOperation[] {
  return NETWORK.routes.get(routeKey(a, b)) ?? [];
}

export function getDirectDestinations(iata: string): string[] {
  return [...(NETWORK.neighbours.get(iata) ?? [])].sort();
}

export function hasDirect(a: string, b: string) {
  return NETWORK.routes.has(routeKey(a, b));
}

/** Connections longer than this multiple of the nonstop distance aren't offered. */
const MAX_DETOUR = 1.35;

function detour(a: string, hub: string, b: string) {
  const [pa, ph, pb] = [getAirport(a)!, getAirport(hub)!, getAirport(b)!];
  return (distanceMiles(pa, ph) + distanceMiles(ph, pb)) / Math.max(1, distanceMiles(pa, pb));
}

/** Sensible one-stop connections a -> hub -> b, shortest detour first. */
export function getConnectingHubs(a: string, b: string): string[] {
  const fromA = NETWORK.neighbours.get(a);
  const toB = NETWORK.neighbours.get(b);
  if (!fromA || !toB) return [];
  return [...fromA]
    .filter((hub) => hub !== b && toB.has(hub))
    .map((hub) => ({ hub, ratio: detour(a, hub, b) }))
    .filter(({ ratio }) => ratio <= MAX_DETOUR)
    .sort((x, y) => x.ratio - y.ratio)
    .map(({ hub }) => hub);
}

/** Destinations reachable with one sensible connection but no nonstop. */
export function getConnectingDestinations(iata: string): string[] {
  const direct = NETWORK.neighbours.get(iata) ?? new Set<string>();
  const result = new Set<string>();
  for (const hub of direct) {
    for (const dest of NETWORK.neighbours.get(hub) ?? []) {
      if (dest !== iata && !direct.has(dest) && detour(iata, hub, dest) <= MAX_DETOUR) {
        result.add(dest);
      }
    }
  }
  return [...result].sort();
}

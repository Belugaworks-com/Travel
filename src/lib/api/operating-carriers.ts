/**
 * Turns Aviationstack flight rows into the airlines that actually operate a
 * route. Codeshares are credited to the operating carrier. Some codeshare rows
 * arrive without their `codeshared` link (e.g. EK9618 on SIN-SYD); they're
 * spotted by sharing a departure slot with a flight that is known to be
 * operated by someone else, and dropped.
 */

export interface AviationstackFlight {
  departure?: { scheduled?: string | null } | null;
  airline?: { iata?: string | null; name?: string | null } | null;
  flight?: {
    iata?: string | null;
    codeshared?: { airline_iata?: string; airline_name?: string; flight_iata?: string } | null;
  } | null;
}

export interface OperatingCarrier {
  airline: string;
  airlineName: string;
  /** A representative operating flight number. */
  flightNumber: string;
  /** Distinct operated departures seen. */
  flights: number;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const isCode = (s: string) => /^[A-Z0-9]{2}$/.test(s);

export function operatingCarriers(rows: AviationstackFlight[]): OperatingCarrier[] {
  // Operated flights referenced by codeshares, per departure slot.
  const operatedBySlot = new Map<string, Set<string>>();
  for (const row of rows) {
    const op = row.flight?.codeshared?.flight_iata?.toUpperCase();
    if (!op) continue;
    const slot = row.departure?.scheduled ?? "";
    if (!operatedBySlot.has(slot)) operatedBySlot.set(slot, new Set());
    operatedBySlot.get(slot)!.add(op);
  }

  // Each operated flight once: flight number -> carrier.
  const operated = new Map<string, { code: string; name: string }>();
  for (const row of rows) {
    const cs = row.flight?.codeshared;
    if (cs) {
      const code = (cs.airline_iata ?? "").toUpperCase();
      const number = (cs.flight_iata ?? "").toUpperCase();
      if (isCode(code) && number && !operated.has(number)) {
        operated.set(number, { code, name: cs.airline_name ?? code });
      }
      continue;
    }
    const code = (row.airline?.iata ?? "").toUpperCase();
    const number = (row.flight?.iata ?? "").toUpperCase();
    if (!isCode(code) || !number) continue;
    const knownInSlot = operatedBySlot.get(row.departure?.scheduled ?? "");
    // Another airline operates this slot and it isn't this flight: a codeshare.
    if (knownInSlot && !knownInSlot.has(number)) continue;
    if (!operated.has(number)) operated.set(number, { code, name: row.airline?.name ?? code });
  }

  const carriers = new Map<string, OperatingCarrier>();
  for (const [number, { code, name }] of operated) {
    const entry = carriers.get(code);
    if (entry) entry.flights++;
    else carriers.set(code, { airline: code, airlineName: titleCase(name), flightNumber: number, flights: 1 });
  }
  return [...carriers.values()].sort((a, b) => b.flights - a.flights);
}

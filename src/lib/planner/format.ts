import { getAirport } from "@/lib/data/airports";
import { calculateStaffFare } from "@/lib/staff-travel/engine";
import { distanceMiles } from "@/lib/geo";

import { flightMiles } from "./timeline";
import type { FlightItem } from "./types";

const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const longDayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

export const formatDay = (day: string) => dayFormat.format(asDate(day));
export const formatLongDay = (day: string) => longDayFormat.format(asDate(day));
export const formatMonth = (day: string) => monthFormat.format(asDate(day));

/** Short zone name at a moment, e.g. "GMT", "EST", "GMT+8". */
export function zoneAbbr(tz: string, ms: number) {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(new Date(ms))
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

/** All-in price of a planned flight under its fare mode. */
export function flightPrice(f: FlightItem) {
  const a = getAirport(f.segments[0].from);
  const b = getAirport(f.segments.at(-1)!.to);
  const miles = a && b ? distanceMiles(a, b) : flightMiles(f);
  return calculateStaffFare({ fare: f.fare, mode: f.fareMode, cabin: f.cabin, distanceMiles: miles }).total;
}

/** "+1" when a flight lands on a later local date than it left. */
export function dayShift(departAt: string, arriveAt: string) {
  const diff = Math.round(
    (Date.parse(`${arriveAt.slice(0, 10)}T00:00:00Z`) - Date.parse(`${departAt.slice(0, 10)}T00:00:00Z`)) / 86_400_000,
  );
  return diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "";
}

/** Time zones of SkyPlan's airports, for item editing. */
export function zoneOptions() {
  const seen = new Map<string, string>();
  for (const iata of ["LHR", "CDG", "FRA", "AMS", "MAD", "LIS", "FCO", "ZRH", "DUB", "IST", "DXB", "DOH", "DEL", "JNB", "SIN", "BKK", "HKG", "HND", "ICN", "SYD", "AKL", "HNL", "JFK", "ORD", "DFW", "LAX", "YYZ", "MEX", "GRU"]) {
    const a = getAirport(iata)!;
    if (!seen.has(a.tz)) seen.set(a.tz, `${a.city} (${a.tz})`);
  }
  return [...seen].map(([value, label]) => ({ value, label }));
}

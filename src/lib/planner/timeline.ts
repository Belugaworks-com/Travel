import { getAirport } from "@/lib/data/airports";
import { calculateStaffFare } from "@/lib/staff-travel/engine";
import {
  dateOf,
  eachDay,
  impliedOffset,
  localToInstant,
  localWithOffsetToInstant,
} from "@/lib/time";
import type { FareMode, FlightSegment } from "@/lib/types";
import { distanceMiles } from "@/lib/geo";

import type { FlightItem, Trip, TripItem } from "./types";

/**
 * Absolute departure/arrival instants for each segment. Airports SkyPlan has
 * no zone for (live connections through other airports) get their UTC offset
 * from the previous leg: departure instant + block time vs. printed local time.
 */
export function segmentInstants(segments: FlightSegment[]) {
  const offsets = new Map<string, number>();
  const zoned = (local: string, iata: string) => {
    const tz = getAirport(iata)?.tz;
    if (tz) return localToInstant(local, tz);
    const offset = offsets.get(iata);
    return offset === undefined ? null : localWithOffsetToInstant(local, offset);
  };

  return segments.map((seg) => {
    const depart = zoned(seg.departAt, seg.from) ?? localWithOffsetToInstant(seg.departAt, 0);
    let arrive = zoned(seg.arriveAt, seg.to);
    if (arrive === null) {
      arrive = depart + seg.durationMinutes * 60_000;
      offsets.set(seg.to, impliedOffset(seg.arriveAt, arrive));
    }
    return { depart, arrive };
  });
}

export function itemStart(item: TripItem) {
  if (item.kind === "flight") return segmentInstants(item.segments)[0].depart;
  return localToInstant(item.allDay ? `${dateOf(item.start)}T00:00` : item.start, item.tz);
}

export function itemEnd(item: TripItem) {
  if (item.kind === "flight") return segmentInstants(item.segments).at(-1)!.arrive;
  if (!item.end) return itemStart(item);
  return localToInstant(item.end, item.endTz ?? item.tz);
}

/** The local date an item belongs to on the agenda. */
export const itemDay = (item: TripItem) => dateOf(item.start);

export function sortItems(items: TripItem[]) {
  return [...items].sort((a, b) => {
    const day = itemDay(a).localeCompare(itemDay(b));
    if (day) return day;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (a.allDay && b.allDay) return a.order - b.order;
    return itemStart(a) - itemStart(b) || a.order - b.order;
  });
}

export function tripRange(trip: Trip): [string, string] | null {
  if (trip.items.length === 0) return null;
  let from = "9999-12-31";
  let to = "0000-01-01";
  for (const item of trip.items) {
    const start = itemDay(item);
    const end = item.end ? dateOf(item.end) : item.kind === "flight" ? dateOf(item.segments.at(-1)!.arriveAt) : start;
    if (start < from) from = start;
    if (end > to) to = end;
  }
  return [from, to];
}

/** Items per day for every day of the trip (empty days included). */
export function groupByDay(trip: Trip) {
  const range = tripRange(trip);
  const days = new Map<string, TripItem[]>();
  if (!range) return days;
  for (const day of eachDay(range[0], range[1])) days.set(day, []);
  for (const item of sortItems(trip.items)) days.get(itemDay(item))?.push(item);
  return days;
}

const flights = (trip: Trip) =>
  sortItems(trip.items).filter((i): i is FlightItem => i.kind === "flight" && i.status !== "cancelled");

/** City you're in at the end of each day, from the last arrival so far. */
export function locationByDay(trip: Trip) {
  const result = new Map<string, string>();
  const range = tripRange(trip);
  if (!range) return result;
  const fs = flights(trip);
  let where = trip.home;
  let i = 0;
  for (const day of eachDay(range[0], range[1])) {
    while (i < fs.length && dateOf(fs[i].segments.at(-1)!.arriveAt) <= day) {
      where = fs[i].segments.at(-1)!.to;
      i++;
    }
    if (where) result.set(day, where);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export interface PlanWarning {
  level: "error" | "warn" | "info";
  itemIds: string[];
  day?: string;
  message: string;
}

const isStandby = (f: FlightItem) => f.fareMode === "id90" || f.fareMode === "zed";

/** Minimum time between separate flights, longer for non-revs who may roll to a later one. */
function minimumConnection(prev: FlightItem, next: FlightItem) {
  const a = getAirport(prev.segments.at(-1)!.to);
  const b = getAirport(next.segments[0].to);
  const international = !a || !b || a.country !== b.country;
  const base = international ? 120 : 75;
  return isStandby(next) ? base + 60 : base;
}

const cityOf = (iata: string) => getAirport(iata)?.city ?? iata;
const label = (f: FlightItem) => f.segments.map((s) => s.flightNumber).join("/");

export function checkTrip(trip: Trip): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const fs = flights(trip);

  // Consecutive flights: position and connection time.
  for (let i = 1; i < fs.length; i++) {
    const prev = fs[i - 1];
    const next = fs[i];
    const landed = prev.segments.at(-1)!.to;
    const leaves = next.segments[0].from;
    const gap = (itemStart(next) - itemEnd(prev)) / 60_000;
    if (landed !== leaves) {
      const sameCity = cityOf(landed) === cityOf(leaves);
      warnings.push({
        level: sameCity ? "info" : "warn",
        itemIds: [prev.id, next.id],
        day: itemDay(next),
        message: sameCity
          ? `${label(prev)} lands at ${landed} but ${label(next)} leaves from ${leaves}: allow time to change airports.`
          : `${label(prev)} lands in ${cityOf(landed)} but ${label(next)} leaves from ${cityOf(leaves)}.`,
      });
    }
    if (gap < 0) {
      warnings.push({
        level: "error",
        itemIds: [prev.id, next.id],
        day: itemDay(next),
        message: `${label(next)} departs before ${label(prev)} lands.`,
      });
    } else if (landed === leaves && gap < minimumConnection(prev, next)) {
      warnings.push({
        level: "warn",
        itemIds: [prev.id, next.id],
        day: itemDay(next),
        message: `Only ${Math.round(gap)} min to connect from ${label(prev)} to ${label(next)}${isStandby(next) ? " on standby" : ""}.`,
      });
    }
  }

  // Timed items that overlap a flight.
  for (const f of fs) {
    const [s, e] = [itemStart(f), itemEnd(f)];
    for (const other of trip.items) {
      if (other.kind === "flight" || other.kind === "stay" || other.kind === "note" || other.allDay) continue;
      const [os, oe] = [itemStart(other), Math.max(itemStart(other), itemEnd(other))];
      if (os < e && oe > s) {
        warnings.push({
          level: "warn",
          itemIds: [f.id, other.id],
          day: itemDay(other),
          message: `"${other.title}" overlaps ${label(f)}.`,
        });
      }
    }
  }

  // Standby flights without a plan B.
  for (const f of fs) {
    if (isStandby(f) && f.backups.length === 0 && !["boarded", "checked_in"].includes(f.status)) {
      warnings.push({
        level: "info",
        itemIds: [f.id],
        day: itemDay(f),
        message: `${label(f)} is standby with no backup flight.`,
      });
    }
  }

  // Moved flights whose price is for another date.
  for (const f of fs) {
    if (f.pricedFor !== dateOf(f.segments[0].departAt)) {
      warnings.push({
        level: "info",
        itemIds: [f.id],
        day: itemDay(f),
        message: `${label(f)} was moved; its price is from ${f.pricedFor}. Search again to re-price.`,
      });
    }
  }

  // Nights away from home with nowhere to stay.
  const where = locationByDay(trip);
  const range = tripRange(trip);
  if (range && fs.length > 0) {
    const lastDeparture = dateOf(fs.at(-1)!.segments[0].departAt);
    const stays = trip.items.filter((i) => i.kind === "stay");
    for (const day of eachDay(range[0], range[1])) {
      const city = where.get(day);
      if (!city || city === trip.home || day >= lastDeparture) continue;
      // An overnight flight that day counts as the night's bed.
      const flyingOvernight = fs.some(
        (f) => dateOf(f.segments[0].departAt) === day && dateOf(f.segments.at(-1)!.arriveAt) > day,
      );
      const covered = stays.some((s) => dateOf(s.start) <= day && (s.end ? dateOf(s.end) > day : dateOf(s.start) === day));
      if (!covered && !flyingOvernight) {
        warnings.push({ level: "info", itemIds: [], day, message: `No place to stay in ${cityOf(city)} on the night of ${day}.` });
      }
    }
  }

  const rank = { error: 0, warn: 1, info: 2 };
  return warnings.sort((a, b) => rank[a.level] - rank[b.level] || (a.day ?? "").localeCompare(b.day ?? ""));
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export function flightMiles(f: FlightItem) {
  let miles = 0;
  for (const s of f.segments) {
    const a = getAirport(s.from);
    const b = getAirport(s.to);
    if (a && b) miles += distanceMiles(a, b);
  }
  return miles;
}

/** What the trip's flights cost as planned, and the commercial price for comparison. */
export function tripTotals(trip: Trip) {
  const fs = flights(trip);
  let planned = 0;
  let commercial = 0;
  let minutes = 0;
  let miles = 0;
  for (const f of fs) {
    const first = f.segments[0];
    const last = f.segments.at(-1)!;
    const a = getAirport(first.from);
    const b = getAirport(last.to);
    const od = a && b ? distanceMiles(a, b) : flightMiles(f);
    const at = (mode: FareMode) => calculateStaffFare({ fare: f.fare, mode, cabin: f.cabin, distanceMiles: od }).total;
    planned += at(f.fareMode);
    commercial += at("commercial");
    minutes += f.segments.reduce((m, s) => m + s.durationMinutes, 0);
    miles += flightMiles(f);
  }
  return {
    flights: fs.length,
    planned: Math.round(planned),
    commercial: Math.round(commercial),
    savings: Math.round(commercial - planned),
    flightMinutes: minutes,
    miles: Math.round(miles),
  };
}

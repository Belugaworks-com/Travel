import { describe, expect, it } from "vitest";

import type { FlightSegment } from "@/lib/types";

import { buildIcs, googleCalendarUrl, itemEvents } from "./ics";
import { checkTrip, groupByDay, locationByDay, segmentInstants, tripTotals } from "./timeline";
import type { FlightItem, Trip, TripItem } from "./types";

const seg = (p: Partial<FlightSegment> & Pick<FlightSegment, "from" | "to" | "departAt" | "arriveAt" | "durationMinutes">): FlightSegment => ({
  airline: "BA",
  airlineName: "British Airways",
  flightNumber: "BA117",
  aircraft: "Boeing 777-300ER",
  ...p,
});

const flight = (id: string, segments: FlightSegment[], extra: Partial<FlightItem> = {}): FlightItem => ({
  id,
  kind: "flight",
  title: "",
  start: segments[0].departAt,
  tz: "Europe/London",
  order: 0,
  segments,
  layovers: [],
  cabin: "economy",
  fareMode: "commercial",
  fare: { baseFare: 500, governmentTaxes: 200, carrierSurcharge: 100, currency: "USD" },
  price: 800,
  currency: "USD",
  status: "confirmed",
  source: "live",
  pricedFor: segments[0].departAt.slice(0, 10),
  backups: [],
  ...extra,
});

const outbound = flight("out", [
  seg({ from: "LHR", to: "JFK", departAt: "2026-11-20T08:20", arriveAt: "2026-11-20T11:20", durationMinutes: 480 }),
]);
const inbound = flight(
  "back",
  [seg({ flightNumber: "BA178", from: "JFK", to: "LHR", departAt: "2026-11-23T19:30", arriveAt: "2026-11-24T07:25", durationMinutes: 415 })],
  { fareMode: "id90", status: "listed", tz: "America/New_York" },
);
const hotel: TripItem = {
  id: "hotel",
  kind: "stay",
  title: "The Bowery",
  place: "The Bowery Hotel",
  start: "2026-11-20T15:00",
  end: "2026-11-22T11:00",
  tz: "America/New_York",
  order: 0,
};
const museum: TripItem = {
  id: "moma",
  kind: "activity",
  title: "MoMA",
  start: "2026-11-23T19:00",
  end: "2026-11-23T21:00",
  tz: "America/New_York",
  order: 0,
};

const trip: Trip = { id: "t", name: "New York, Nov", home: "LHR", createdAt: 0, items: [inbound, museum, hotel, outbound] };

describe("segmentInstants", () => {
  it("uses airport zones", () => {
    const [t] = segmentInstants(outbound.segments);
    expect(new Date(t.depart).toISOString()).toBe("2026-11-20T08:20:00.000Z");
    expect(new Date(t.arrive).toISOString()).toBe("2026-11-20T16:20:00.000Z");
  });

  it("derives the offset of an airport SkyPlan doesn't know from the previous leg", () => {
    const times = segmentInstants([
      seg({ from: "LHR", to: "BRU", departAt: "2026-11-20T06:50", arriveAt: "2026-11-20T09:00", durationMinutes: 70 }),
      seg({ from: "BRU", to: "JFK", departAt: "2026-11-20T10:30", arriveAt: "2026-11-20T12:55", durationMinutes: 505 }),
    ]);
    // BRU is UTC+1 in November: 10:30 local = 09:30Z.
    expect(new Date(times[1].depart).toISOString()).toBe("2026-11-20T09:30:00.000Z");
  });
});

describe("agenda", () => {
  it("lists every day of the trip in order", () => {
    const days = groupByDay(trip);
    expect([...days.keys()]).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]);
    expect(days.get("2026-11-23")!.map((i) => i.id)).toEqual(["moma", "back"]);
  });

  it("tracks where you are each night", () => {
    const where = locationByDay(trip);
    expect(where.get("2026-11-21")).toBe("JFK");
    expect(where.get("2026-11-24")).toBe("LHR");
  });
});

describe("checkTrip", () => {
  const messages = checkTrip(trip).map((w) => w.message);

  it("flags an activity that overlaps a flight", () => {
    expect(messages.some((m) => m.includes("MoMA") && m.includes("BA178"))).toBe(true);
  });

  it("flags a standby flight with no backup", () => {
    expect(messages).toContain("BA178 is standby with no backup flight.");
  });

  it("flags nights away without a stay", () => {
    expect(messages).toContain("No place to stay in New York on the night of 2026-11-22.");
    expect(messages.some((m) => m.includes("2026-11-21"))).toBe(false);
  });

  it("flags tight and impossible connections", () => {
    const tight: Trip = {
      ...trip,
      items: [
        outbound,
        flight("next", [seg({ flightNumber: "AA100", from: "JFK", to: "LAX", departAt: "2026-11-20T12:00", arriveAt: "2026-11-20T15:00", durationMinutes: 360 })]),
      ],
    };
    expect(checkTrip(tight).some((w) => w.level === "warn" && w.message.startsWith("Only 40 min"))).toBe(true);
  });
});

describe("tripTotals", () => {
  it("prices standby legs at the staff fare", () => {
    const t = tripTotals(trip);
    expect(t.flights).toBe(2);
    expect(t.commercial).toBe(1600);
    expect(t.planned).toBe(800 + 350);
    expect(t.savings).toBe(450);
  });
});

describe("calendar export", () => {
  const ics = buildIcs(trip, Date.UTC(2026, 9, 7));

  it("writes flights in UTC and stays as all-day events", () => {
    expect(ics).toContain("DTSTART:20261120T082000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261122");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("escapes text", () => {
    const withComma = buildIcs({ ...trip, items: [{ ...museum, title: "MoMA, then dinner; late" }] });
    expect(withComma).toContain("SUMMARY:MoMA\\, then dinner\; late");
  });

  it("builds Google Calendar links", () => {
    const url = new URL(googleCalendarUrl(itemEvents(outbound)[0]));
    expect(url.searchParams.get("dates")).toBe("20261120T082000Z/20261120T162000Z");
  });
});

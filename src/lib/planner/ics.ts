import { getAirport } from "@/lib/data/airports";
import { addDaysLocal, dateOf } from "@/lib/time";
import { CABIN_LABEL, FARE_MODE_LABEL } from "@/lib/types";

import { itemEnd, itemStart, segmentInstants, sortItems } from "./timeline";
import { FLIGHT_STATUS_LABEL, type Trip, type TripItem } from "./types";

/** iCalendar export (RFC 5545) and Google Calendar links for trip items. */

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateStamp = (local: string) => dateOf(local).replace(/-/g, "");

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets, as the spec requires. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

interface CalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: { ms: number } | { date: string };
  end: { ms: number } | { date: string };
}

const airportLabel = (iata: string) => {
  const a = getAirport(iata);
  return a ? `${a.name} (${iata}), ${a.city}` : iata;
};

export function itemEvents(item: TripItem): CalEvent[] {
  if (item.kind === "flight") {
    const times = segmentInstants(item.segments);
    return item.segments.map((seg, i) => ({
      uid: `${item.id}-${i}@skyplan`,
      summary: `✈ ${seg.flightNumber} ${seg.from}→${seg.to}`,
      location: airportLabel(seg.from),
      description: [
        `${seg.airlineName} ${seg.flightNumber} · ${seg.aircraft}`,
        `${airportLabel(seg.from)} → ${airportLabel(seg.to)}`,
        `${CABIN_LABEL[item.cabin]} · ${FARE_MODE_LABEL[item.fareMode]} · ${FLIGHT_STATUS_LABEL[item.status]}`,
        item.backups.length ? `Backups: ${item.backups.map((b) => b.segments.map((s) => s.flightNumber).join("/")).join(", ")}` : "",
        item.notes ?? "",
      ]
        .filter(Boolean)
        .join("\n"),
      start: { ms: times[i].depart },
      end: { ms: times[i].arrive },
    }));
  }
  const base = {
    uid: `${item.id}@skyplan`,
    summary: item.kind === "stay" ? `🏨 ${item.title}` : item.title,
    description: item.notes,
    location: item.kind === "stay" ? [item.place, item.address].filter(Boolean).join(", ") : item.kind === "note" ? undefined : item.place,
  };
  if (item.allDay || item.kind === "stay" || item.kind === "note") {
    const endDay = item.end ? dateOf(item.end) : dateOf(item.start);
    // All-day DTEND is exclusive; a stay's checkout day isn't a night there.
    const exclusiveEnd = item.kind === "stay" && endDay > dateOf(item.start) ? endDay : addDaysLocal(`${endDay}T00:00`, 1);
    return [{ ...base, start: { date: dateOf(item.start) }, end: { date: dateOf(exclusiveEnd) } }];
  }
  const start = itemStart(item);
  return [{ ...base, start: { ms: start }, end: { ms: Math.max(itemEnd(item), start + 60 * 60_000) } }];
}

export function buildIcs(trip: Trip, now = Date.now()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SkyPlan//Trip planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(trip.name)}`,
  ];
  for (const item of sortItems(trip.items)) {
    for (const ev of itemEvents(item)) {
      lines.push("BEGIN:VEVENT", `UID:${ev.uid}`, `DTSTAMP:${utcStamp(now)}`);
      lines.push("ms" in ev.start ? `DTSTART:${utcStamp(ev.start.ms)}` : `DTSTART;VALUE=DATE:${dateStamp(ev.start.date)}`);
      lines.push("ms" in ev.end ? `DTEND:${utcStamp(ev.end.ms)}` : `DTEND;VALUE=DATE:${dateStamp(ev.end.date)}`);
      lines.push(`SUMMARY:${escapeText(ev.summary)}`);
      if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
      if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
      lines.push("END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" link for one event. */
export function googleCalendarUrl(ev: CalEvent) {
  const fmt = (t: CalEvent["start"]) => ("ms" in t ? utcStamp(t.ms) : dateStamp(t.date));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.summary,
    dates: `${fmt(ev.start)}/${fmt(ev.end)}`,
  });
  if (ev.description) params.set("details", ev.description);
  if (ev.location) params.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

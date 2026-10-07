"use client";

import { CalendarPlus, Check } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { getAirport } from "@/lib/data/airports";
import { flightItemFromOffer, usePlanner } from "@/lib/planner/store";
import type { ReportedLoads } from "@/lib/staff-travel/engine";
import type { DataSource, FareMode, FlightOffer } from "@/lib/types";

const NEW = "__new__";

/** Pick a trip (or start one) and add a flight to it. */
export function AddToTrip({
  offer,
  fareMode,
  source,
  reportedLoads,
  backups,
  onNavigate,
}: {
  offer: FlightOffer;
  fareMode: FareMode;
  source: DataSource;
  reportedLoads?: Record<string, ReportedLoads>;
  backups?: FlightOffer[];
  /** Called when "Open planner" navigates away, e.g. to close a dialog. */
  onNavigate?: () => void;
}) {
  const trips = usePlanner((s) => s.trips);
  const activeTripId = usePlanner((s) => s.activeTripId);
  const createTrip = usePlanner((s) => s.createTrip);
  const addItem = usePlanner((s) => s.addItem);
  const setActiveTrip = usePlanner((s) => s.setActiveTrip);
  const dest = getAirport(offer.segments.at(-1)!.to);
  const [tripId, setTripId] = useState(activeTripId ?? trips[0]?.id ?? NEW);
  const [name, setName] = useState(dest ? `${dest.city} trip` : "New trip");
  const [added, setAdded] = useState<string | null>(null);
  const ids = { trip: useId(), name: useId() };

  const add = () => {
    const target = tripId === NEW ? createTrip(name.trim() || "New trip", offer.segments[0].from) : tripId;
    addItem(target, flightItemFromOffer(offer, { fareMode, source, reportedLoads, backups }));
    setActiveTrip(target);
    setAdded(target);
  };

  if (added) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-good">
          <Check className="size-4" /> Added to {trips.find((t) => t.id === added)?.name ?? "your trip"}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href="/planner" onNavigate={onNavigate}>
            Open planner
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="grid flex-1 gap-1.5">
        <label htmlFor={ids.trip} className="text-xs font-medium">
          Trip
        </label>
        <select
          id={ids.trip}
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value={NEW}>New trip…</option>
        </select>
      </div>
      {tripId === NEW && (
        <div className="grid flex-1 gap-1.5">
          <label htmlFor={ids.name} className="text-xs font-medium">
            Trip name
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
      )}
      <Button onClick={add} variant="signal">
        <CalendarPlus /> Add to trip
      </Button>
    </div>
  );
}

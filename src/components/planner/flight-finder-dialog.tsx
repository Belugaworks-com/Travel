"use client";

import { ArrowRightLeft, Plus } from "lucide-react";
import { useId, useState } from "react";

import { OddsText } from "@/components/flights/standby-panel";
import { SourceNote } from "@/components/flights/source-note";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useFlightSearch } from "@/hooks/use-flights";
import { AIRPORTS } from "@/lib/data/airports";
import { flightItemFromOffer, usePlanner } from "@/lib/planner/store";
import { routeDistance } from "@/lib/pricing/sample-fares";
import { calculateStaffFare } from "@/lib/staff-travel/engine";
import { offerOdds } from "@/lib/staff-travel/offer-odds";
import { useSkyPlan } from "@/lib/store";
import { CABIN_LABEL, CABINS, FARE_MODE_LABEL, type Cabin, type FlightOffer } from "@/lib/types";
import { formatDuration, formatMoney } from "@/lib/utils";

const field =
  "h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const SORTED = [...AIRPORTS].sort((a, b) => a.city.localeCompare(b.city));

function Results({
  tripId,
  from,
  to,
  date,
  cabin,
  onAdded,
}: {
  tripId: string;
  from: string;
  to: string;
  date: string;
  cabin: Cabin;
  onAdded: () => void;
}) {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const profile = useSkyPlan((s) => s.staffProfile);
  const addItem = usePlanner((s) => s.addItem);
  const search = useFlightSearch(from, to, date, cabin);
  const standby = fareMode === "id90" || fareMode === "zed";
  const miles = routeDistance(from, to);

  if (search.isPending) {
    return (
      <div className="space-y-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (search.isError) return <p className="text-sm text-bad">Couldn&apos;t search: {search.error.message}</p>;
  if (search.data.offers.length === 0) return <p className="text-sm text-muted-foreground">No flights found.</p>;

  const add = (offer: FlightOffer) => {
    addItem(tripId, flightItemFromOffer(offer, { fareMode, source: search.data.source }));
    onAdded();
  };

  return (
    <div className="space-y-2">
      <ul className="max-h-[50dvh] divide-y overflow-y-auto rounded-md border">
        {search.data.offers.map((offer) => {
          const first = offer.segments[0];
          const last = offer.segments.at(-1)!;
          const odds = standby
            ? offerOdds(offer, { mode: fareMode, cabin, profile, typicalRange: search.data.insights?.typicalRange })
            : null;
          return (
            <li key={offer.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium tabular-nums">
                  {first.departAt.slice(11, 16)}–{last.arriveAt.slice(11, 16)}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {offer.segments.map((s) => s.flightNumber).join("/")}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {offer.layovers.length === 0 ? "Nonstop" : `via ${offer.layovers.map((l) => l.airport).join(", ")}`} ·{" "}
                  {formatDuration(offer.totalDurationMinutes)} · {first.aircraft}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatMoney(calculateStaffFare({ fare: offer.fare, mode: fareMode, cabin, distanceMiles: miles }).total)}
                </p>
                {odds !== null && <OddsText odds={odds} className="text-xs font-medium" />}
              </div>
              <Button size="icon" variant="outline" className="size-8" aria-label="Add this flight" onClick={() => add(offer)}>
                <Plus />
              </Button>
            </li>
          );
        })}
      </ul>
      <SourceNote
        source={search.data.source}
        live="Live prices from Google Flights."
        sample="Sample fares and schedules."
      />
    </div>
  );
}

/** Search flights and add one to the trip. */
export function FlightFinderDialog({
  tripId,
  defaultFrom,
  defaultTo,
  defaultDay,
  onOpenChange,
}: {
  tripId: string;
  defaultFrom?: string;
  defaultTo?: string;
  defaultDay: string;
  onOpenChange: (open: boolean) => void;
}) {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const defaultCabin = useSkyPlan((s) => s.cabin);
  const id = useId();
  const [from, setFrom] = useState(defaultFrom ?? "LHR");
  const [to, setTo] = useState(defaultTo && defaultTo !== defaultFrom ? defaultTo : from === "JFK" ? "LHR" : "JFK");
  const [date, setDate] = useState(defaultDay);
  const [cabin, setCabin] = useState<Cabin>(defaultCabin);
  const [submitted, setSubmitted] = useState<{ from: string; to: string; date: string; cabin: Cabin } | null>(null);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a flight</DialogTitle>
          <DialogDescription>Prices show as {FARE_MODE_LABEL[fareMode]}; change the fare type in the header.</DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            if (from !== to) setSubmitted({ from, to, date, cabin });
          }}
        >
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-from`} className="text-xs font-medium">
              From
            </label>
            <select id={`${id}-from`} className={field} value={from} onChange={(e) => setFrom(e.target.value)}>
              {SORTED.map((a) => (
                <option key={a.iata} value={a.iata}>
                  {a.city} ({a.iata})
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden self-end sm:inline-flex"
            aria-label="Swap origin and destination"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <ArrowRightLeft />
          </Button>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-to`} className="text-xs font-medium">
              To
            </label>
            <select id={`${id}-to`} className={field} value={to} onChange={(e) => setTo(e.target.value)}>
              {SORTED.map((a) => (
                <option key={a.iata} value={a.iata}>
                  {a.city} ({a.iata})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-date`} className="text-xs font-medium">
              Date
            </label>
            <input id={`${id}-date`} type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="hidden sm:block" />
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-cabin`} className="text-xs font-medium">
              Cabin
            </label>
            <select id={`${id}-cabin`} className={field} value={cabin} onChange={(e) => setCabin(e.target.value as Cabin)}>
              {CABINS.map((c) => (
                <option key={c} value={c}>
                  {CABIN_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          {from === to && <p className="col-span-full text-sm text-bad">Pick two different airports.</p>}
          <Button type="submit" className="col-span-full" disabled={from === to || !date}>
            Search flights
          </Button>
        </form>
        {submitted && (
          <Results tripId={tripId} {...submitted} onAdded={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

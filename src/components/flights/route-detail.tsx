"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFlightSearch, useRouteInfo } from "@/hooks/use-flights";
import { getAirport } from "@/lib/data/airports";
import { zedZoneFor } from "@/lib/staff-travel/engine";
import { priceIn } from "@/lib/staff-travel/price";
import { useOpenRoute, useSkyPlan } from "@/lib/store";
import { FARE_MODE_LABEL, type FlightOffer } from "@/lib/types";
import { formatDuration, formatMoney } from "@/lib/utils";

import { FareLevelBadge } from "./fare-level-badge";
import { QuickBookDialog } from "./quick-book-dialog";
import { RouteInspector } from "./route-inspector";
import { SourceNote } from "./source-note";

const time = (iso: string) => iso.slice(11, 16);

function OfferRow({
  offer,
  distanceMiles,
  onCompare,
}: {
  offer: FlightOffer;
  distanceMiles: number;
  onCompare: () => void;
}) {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const first = offer.segments[0];
  const last = offer.segments[offer.segments.length - 1];
  const total = priceIn(fareMode, offer.fare, offer.cabin, distanceMiles);
  const stops = offer.layovers.length;

  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          {time(first.departAt)}
          <ArrowRight className="size-3 text-muted-foreground" />
          {time(last.arriveAt)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {formatDuration(offer.totalDurationMinutes)} ·{" "}
            {stops === 0
              ? "Nonstop"
              : `${stops} stop · ${offer.layovers.map((l) => `${l.airport} ${formatDuration(l.durationMinutes)}`).join(", ")}`}
          </span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[...new Set(offer.segments.map((s) => s.airlineName))].join(" + ")} ·{" "}
          <span className="font-mono">{offer.segments.map((s) => s.flightNumber).join(" / ")}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{offer.segments.map((s) => s.aircraft).join(" / ")}</p>
      </div>
      <div className="row-span-3 flex flex-col items-end justify-between gap-2">
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums">{formatMoney(total, offer.currency)}</span>
          {fareMode !== "commercial" && (
            <span className="block text-[11px] text-muted-foreground tabular-nums line-through">
              {formatMoney(offer.price, offer.currency)}
            </span>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={onCompare}>
          Book
        </Button>
      </div>
    </li>
  );
}

function OffersSkeleton() {
  return (
    <ul className="divide-y" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex justify-between px-4 py-3.5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-8 w-16" />
        </li>
      ))}
    </ul>
  );
}

export function RouteDetail() {
  const route = useOpenRoute();
  const openRoute = useSkyPlan((s) => s.openRoute);
  const date = useSkyPlan((s) => s.travelDate);
  const cabin = useSkyPlan((s) => s.cabin);
  const fareMode = useSkyPlan((s) => s.fareMode);
  const [from, to] = route ?? ["", ""];
  const search = useFlightSearch(from, to, date, cabin);
  const info = useRouteInfo(from, to, date);
  const [booking, setBooking] = useState<FlightOffer | null>(null);

  const a = getAirport(from);
  const b = getAirport(to);
  if (!route || !a || !b) return null;

  const distance = info.data?.distanceMiles;
  const cheapest = search.data?.offers[0];
  const insights = search.data?.insights;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 px-2 pt-2 pb-3 md:pt-3">
        <Button variant="ghost" size="icon" aria-label="Back to all routes" onClick={() => openRoute(null)}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="flex items-center gap-2 font-mono text-xl font-semibold tracking-tight">
            {from} <ArrowRight className="size-4 text-muted-foreground" /> {to}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {a.city} to {b.city}
            {distance !== undefined && (
              <>
                {" "}
                · <span className="tabular-nums">{distance.toLocaleString()} mi</span> · ZED zone{" "}
                {zedZoneFor(distance).zone}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section aria-label="Fare summary" className="mx-4 mb-3 rounded-lg border bg-muted/40 p-3">
          {search.isPending || !distance ? (
            <div className="space-y-2" aria-hidden>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
          ) : cheapest ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Lowest {FARE_MODE_LABEL[fareMode]} fare, one-way</p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(priceIn(fareMode, cheapest.fare, cabin, distance), cheapest.currency)}
                </p>
              </div>
              {insights && (
                <div className="flex flex-col items-end gap-1 text-right">
                  <FareLevelBadge level={insights.level} />
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    Typical {formatMoney(insights.typicalRange[0])}–{formatMoney(insights.typicalRange[1])}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No fares found for this date.</p>
          )}
        </section>

        <section aria-labelledby="flights-h">
          <h3 id="flights-h" className="px-4 pb-1 text-sm font-semibold">
            Flights on <span className="font-mono font-normal tabular-nums">{date}</span>
          </h3>
          {search.isPending ? (
            <OffersSkeleton />
          ) : search.isError ? (
            <p className="px-4 py-3 text-sm text-bad">Couldn&apos;t load flights: {search.error.message}</p>
          ) : (
            <>
              <ul className="divide-y border-y">
                {search.data.offers.map((o) => (
                  <OfferRow key={o.id} offer={o} distanceMiles={distance ?? 0} onCompare={() => setBooking(o)} />
                ))}
              </ul>
              <div className="px-4 py-2.5">
                <SourceNote
                  source={search.data.source}
                  live="Live prices from Google Flights via SerpApi."
                  sample="Sample fares and times. Add a SerpApi key for live Google Flights prices."
                />
              </div>
            </>
          )}
        </section>

        {info.isPending ? (
          <div className="space-y-2 p-4" aria-hidden>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : info.isError ? (
          <p className="px-4 py-3 text-sm text-bad">Couldn&apos;t load route details: {info.error.message}</p>
        ) : (
          <RouteInspector info={info.data} />
        )}
      </div>

      {booking && distance !== undefined && (
        <QuickBookDialog
          offer={booking}
          distanceMiles={distance}
          routeInfo={info.data}
          onOpenChange={(open) => !open && setBooking(null)}
        />
      )}
    </div>
  );
}

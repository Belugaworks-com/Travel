"use client";

import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDestinations } from "@/hooks/use-flights";
import type { DestinationSummary } from "@/lib/api/destinations";
import { getAirport } from "@/lib/data/airports";
import { priceIn } from "@/lib/staff-travel/price";
import { useSkyPlan, type Direction } from "@/lib/store";
import { FARE_MODE_LABEL } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

import { FareLevelBadge } from "./fare-level-badge";
import { RouteDetail } from "./route-detail";
import { SourceNote } from "./source-note";
import { StaffProfileLine } from "./staff-profile-dialog";

function DestinationRow({ d }: { d: DestinationSummary }) {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const cabin = useSkyPlan((s) => s.cabin);
  const openRoute = useSkyPlan((s) => s.openRoute);
  const total = priceIn(fareMode, d.fare, cabin, d.distanceMiles);
  const commercial = priceIn("commercial", d.fare, cabin, d.distanceMiles);

  return (
    <li>
      <button
        type="button"
        onClick={() => openRoute(d.iata)}
        className="grid w-full grid-cols-[3rem_1fr_auto] items-center gap-x-3 px-4 py-2.5 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent"
      >
        <span className="font-mono text-sm font-semibold tracking-tight">{d.iata}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{d.city}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {d.carriers.length > 0 ? d.carriers.join(" · ") : `via ${d.via.join(", ")}`}
            <span className="mx-1.5 text-border">|</span>
            <span className="tabular-nums">{d.distanceMiles.toLocaleString()} mi</span>
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums">{formatMoney(total)}</span>
          {fareMode === "commercial" ? (
            <FareLevelBadge level={d.level} />
          ) : (
            <span className="text-[11px] text-muted-foreground tabular-nums line-through">
              {formatMoney(commercial)}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <li key={i} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-9" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-4 w-14" />
        </li>
      ))}
    </ul>
  );
}

function DestinationList({ origin }: { origin: string }) {
  const direction = useSkyPlan((s) => s.direction);
  const setDirection = useSkyPlan((s) => s.setDirection);
  const cabin = useSkyPlan((s) => s.cabin);
  const fareMode = useSkyPlan((s) => s.fareMode);
  const date = useSkyPlan((s) => s.travelDate);
  const { data, isPending, isError, error, refetch } = useDestinations(origin, direction, cabin, date);
  // Order by the price actually shown, which depends on the fare type.
  const byShownPrice = (list: DestinationSummary[]) =>
    [...list].sort(
      (a, b) => priceIn(fareMode, a.fare, cabin, a.distanceMiles) - priceIn(fareMode, b.fare, cabin, b.distanceMiles),
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
        <ToggleGroup
          type="single"
          value={direction}
          onValueChange={(v) => v && setDirection(v as Direction)}
          aria-label="Direction"
        >
          <ToggleGroupItem value="outbound">
            <ArrowUpRight /> From {origin}
          </ToggleGroupItem>
          <ToggleGroupItem value="inbound">
            <ArrowDownLeft /> To {origin}
          </ToggleGroupItem>
        </ToggleGroup>
        {fareMode !== "commercial" && <StaffProfileLine />}
      </div>

      <Tabs defaultValue="nonstop" className="min-h-0 flex-1 gap-0">
        <div className="px-4 pb-2">
          <TabsList className="w-full">
            <TabsTrigger value="nonstop">
              Nonstop <span className="tabular-nums text-muted-foreground">{data?.nonstop.length ?? ""}</span>
            </TabsTrigger>
            <TabsTrigger value="onestop">
              One stop <span className="tabular-nums text-muted-foreground">{data?.oneStop.length ?? ""}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex items-center justify-between border-y bg-muted/40 px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>Cheapest one-way, {FARE_MODE_LABEL[fareMode]}</span>
          <span className="font-mono tabular-nums">{date}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isPending ? (
            <ListSkeleton />
          ) : isError ? (
            <div className="space-y-3 p-4 text-sm">
              <p className="text-bad">Couldn&apos;t load routes: {error.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <TabsContent value="nonstop">
                <ul className="divide-y">
                  {byShownPrice(data.nonstop).map((d) => (
                    <DestinationRow key={d.iata} d={d} />
                  ))}
                </ul>
              </TabsContent>
              <TabsContent value="onestop">
                {data.oneStop.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Every airport in the network is reachable nonstop from {origin}.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {byShownPrice(data.oneStop).map((d) => (
                      <DestinationRow key={d.iata} d={d} />
                    ))}
                  </ul>
                )}
              </TabsContent>
              <div className="border-t px-4 py-3">
                <SourceNote
                  source={data.source}
                  live="Live fares"
                  sample="Estimated fares from SkyPlan's fare model. Open a route for flight-level prices."
                />
              </div>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

export function CityPanel() {
  const selected = useSkyPlan((s) => s.selected);
  const routeTo = useSkyPlan((s) => s.routeTo);
  const selectAirport = useSkyPlan((s) => s.selectAirport);
  const airport = selected ? getAirport(selected) : null;
  if (!airport) return null;

  return (
    <aside
      aria-label={`${airport.city} routes`}
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[55dvh] flex-col rounded-t-xl border-t bg-background shadow-[0_-8px_30px_-12px] shadow-foreground/15 animate-in slide-in-from-bottom-4 fade-in-0 duration-300 md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-[420px] md:rounded-xl md:border md:shadow-xl md:shadow-foreground/5 md:slide-in-from-right-4 md:slide-in-from-bottom-0"
    >
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
      {routeTo ? (
        <RouteDetail />
      ) : (
        <>
          <div className="flex items-start gap-3 px-4 pt-3 pb-3 md:pt-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <h2 className="font-mono text-2xl font-semibold tracking-tight">{airport.iata}</h2>
                <span className="truncate text-sm font-medium">{airport.city}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {airport.name} · {airport.country}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={() => selectAirport(null)}>
              <X />
            </Button>
          </div>
          <DestinationList origin={airport.iata} />
        </>
      )}
    </aside>
  );
}

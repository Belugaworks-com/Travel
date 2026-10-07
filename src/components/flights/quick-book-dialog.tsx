"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/hooks/use-flights";
import type { RouteInfo } from "@/lib/api/route-info";
import type { StaffRateRequest } from "@/lib/api/schemas";
import { getAirline } from "@/lib/data/network";
import {
  oddsBand,
  type StaffFareBreakdown,
  type StandbyPriority,
} from "@/lib/staff-travel/engine";
import { useSkyPlan } from "@/lib/store";
import { CABIN_LABEL, FARE_MODE_LABEL, type FareMode, type FlightOffer } from "@/lib/types";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

type RateResult = StaffFareBreakdown & {
  priority?: StandbyPriority;
  odds?: number | null;
  advice?: string[];
};

const MODES: FareMode[] = ["commercial", "id50", "id90", "zed"];

const ODDS_STYLE = {
  good: "bg-good",
  fair: "bg-warn",
  poor: "bg-bad",
} as const;

function googleFlightsUrl(offer: FlightOffer) {
  const first = offer.segments[0];
  const last = offer.segments[offer.segments.length - 1];
  const q = `Flights from ${first.from} to ${last.to} on ${first.departAt.slice(0, 10)} ${CABIN_LABEL[offer.cabin]}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export function QuickBookDialog({
  offer,
  distanceMiles,
  routeInfo,
  onOpenChange,
}: {
  offer: FlightOffer;
  distanceMiles: number;
  routeInfo?: RouteInfo;
  onOpenChange: (open: boolean) => void;
}) {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const profile = useSkyPlan((s) => s.staffProfile);
  const first = offer.segments[0];
  const last = offer.segments[offer.segments.length - 1];

  const operator = routeInfo?.operators.find((op) => op.airline === first.airline);
  const body: StaffRateRequest = {
    fare: offer.fare,
    distanceMiles,
    cabin: offer.cabin,
    modes: MODES,
    standby: {
      profile,
      operatingAirline: first.airline,
      sameAlliance:
        getAirline(first.airline)?.alliance !== "none" &&
        getAirline(first.airline)?.alliance === getAirline(profile.airline)?.alliance,
      aircraft: first.aircraft,
      loadFactor: operator?.loadFactor[offer.cabin] ?? 0.82,
    },
  };

  const rates = useQuery({
    queryKey: ["staff-rates", body],
    queryFn: () =>
      getJson<{ results: RateResult[] }>("/api/staff-rates/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  });

  const results = rates.data?.results;
  const current = results?.find((r) => r.mode === fareMode);
  const rows: { label: string; value: (r: RateResult) => number; negative?: boolean }[] = [
    { label: "Published base fare", value: (r) => r.publishedBaseFare },
    { label: "Staff discount", value: (r) => r.discount, negative: true },
    { label: "Government taxes", value: (r) => r.governmentTaxes },
    { label: "Carrier surcharge", value: (r) => r.carrierSurcharge },
  ];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {offer.segments.map((s) => s.flightNumber).join(" / ")} · {first.from} → {last.to}
          </DialogTitle>
          <DialogDescription>
            {first.departAt.slice(0, 10)} · {first.departAt.slice(11, 16)}–{last.arriveAt.slice(11, 16)} ·{" "}
            {formatDuration(offer.totalDurationMinutes)} · {CABIN_LABEL[offer.cabin]} · {first.aircraft}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="sr-only">Fare comparison by fare type</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-xs">
                <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                  One-way
                </th>
                {MODES.map((m) => (
                  <th
                    key={m}
                    scope="col"
                    className={cn(
                      "px-3 py-2 text-right font-semibold",
                      m === fareMode && "bg-signal/15",
                    )}
                  >
                    {FARE_MODE_LABEL[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left text-xs font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  {MODES.map((m) => {
                    const r = results?.find((x) => x.mode === m);
                    const v = r ? row.value(r) : null;
                    return (
                      <td key={m} className={cn("px-3 py-1.5 text-right", m === fareMode && "bg-signal/10")}>
                        {v === null ? (
                          <Skeleton className="ml-auto h-3.5 w-12" />
                        ) : row.negative && v > 0 ? (
                          `−${formatMoney(v)}`
                        ) : (
                          formatMoney(v)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <th scope="row" className="px-3 py-2 text-left">
                  Total
                </th>
                {MODES.map((m) => {
                  const r = results?.find((x) => x.mode === m);
                  return (
                    <td key={m} className={cn("px-3 py-2 text-right", m === fareMode && "bg-signal/15")}>
                      {r ? formatMoney(r.total) : <Skeleton className="ml-auto h-4 w-14" />}
                    </td>
                  );
                })}
              </tr>
              <tr className="text-xs text-muted-foreground">
                <th scope="row" className="px-3 pb-2 text-left font-normal">
                  Seat
                </th>
                {MODES.map((m) => {
                  const r = results?.find((x) => x.mode === m);
                  return (
                    <td key={m} className={cn("px-3 pb-2 text-right capitalize", m === fareMode && "bg-signal/15")}>
                      {r?.boarding ?? ""}
                      {r?.zed && <span className="block normal-case">Zone {r.zed.zone} · {r.zed.level}</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="-mt-2 text-[11px] text-muted-foreground">
          Staff discounts apply to the base fare only; taxes stay fixed. Tax split is estimated from the route. ZED
          figures are a representative zone table.
        </p>

        {rates.isError && <p className="text-sm text-bad">Couldn&apos;t calculate staff fares: {rates.error.message}</p>}

        {current && current.boarding === "standby" && current.priority && (
          <section aria-labelledby="standby-h" className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="standby-h" className="text-sm font-semibold">
                  {current.priority.label}
                </h3>
                <p className="text-xs text-muted-foreground">{current.priority.detail}</p>
              </div>
              {typeof current.odds === "number" && (
                <p className="shrink-0 text-right">
                  <span className="block text-xl font-semibold tabular-nums">{Math.round(current.odds * 100)}%</span>
                  <span className="text-[11px] text-muted-foreground">est. chance to clear</span>
                </p>
              )}
            </div>
            {typeof current.odds === "number" && (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label="Estimated standby odds"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(current.odds * 100)}
              >
                <div
                  className={cn("h-full rounded-full", ODDS_STYLE[oddsBand(current.odds)])}
                  style={{ width: `${Math.max(4, current.odds * 100)}%` }}
                />
              </div>
            )}
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {current.advice?.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {fareMode === "commercial"
              ? "Booking opens Google Flights in a new tab."
              : "List staff tickets through your airline's staff travel portal."}
          </p>
          {fareMode === "commercial" && (
            <Button asChild variant="signal">
              <a href={googleFlightsUrl(offer)} target="_blank" rel="noreferrer">
                Book on Google Flights <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

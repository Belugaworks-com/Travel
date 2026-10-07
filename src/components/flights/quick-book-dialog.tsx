"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

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
import { AddToTrip } from "@/components/planner/add-to-trip";
import type { StaffRateRequest } from "@/lib/api/schemas";
import type { ReportedLoads, StaffFareBreakdown } from "@/lib/staff-travel/engine";
import { offerOdds, sameAlliance } from "@/lib/staff-travel/offer-odds";
import { useSkyPlan } from "@/lib/store";
import { CABIN_LABEL, FARE_MODE_LABEL, type DataSource, type FareMode, type FlightOffer } from "@/lib/types";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

import { BackupList, offerKey, useBackups } from "./backup-list";
import { StandbySummary } from "./standby-panel";

type RateResult = StaffFareBreakdown;

const MODES: FareMode[] = ["commercial", "id50", "id90", "zed"];

function googleFlightsUrl(offer: FlightOffer) {
  const first = offer.segments[0];
  const last = offer.segments[offer.segments.length - 1];
  const q = `Flights from ${first.from} to ${last.to} on ${first.departAt.slice(0, 10)} ${CABIN_LABEL[offer.cabin]}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export function QuickBookDialog({
  offer,
  distanceMiles,
  typicalRange,
  source,
  date,
  onOpenChange,
}: {
  offer: FlightOffer;
  distanceMiles: number;
  typicalRange?: [number, number];
  source: DataSource;
  date: string;
  onOpenChange: (open: boolean) => void;
}) {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const profile = useSkyPlan((s) => s.staffProfile);
  const first = offer.segments[0];
  const last = offer.segments[offer.segments.length - 1];
  const [reportedLoads, setReportedLoads] = useState<Record<string, ReportedLoads>>({});
  const [backups, setBackups] = useState<FlightOffer[]>([]);
  const standby = fareMode === "id90" || fareMode === "zed";
  const odds = standby
    ? offerOdds(offer, { mode: fareMode, cabin: offer.cabin, profile, typicalRange, reportedLoads })
    : 1;
  const backupQuery = useBackups({
    from: first.from,
    to: last.to,
    date,
    cabin: offer.cabin,
    mode: fareMode,
    exclude: offer.segments.map((s) => s.flightNumber),
    enabled: standby,
  });
  const toggleBackup = (o: FlightOffer) =>
    setBackups((list) =>
      list.some((b) => offerKey(b) === offerKey(o)) ? list.filter((b) => offerKey(b) !== offerKey(o)) : [...list, o],
    );

  const body: StaffRateRequest = {
    fare: offer.fare,
    distanceMiles,
    cabin: offer.cabin,
    modes: MODES,
    standby: {
      profile,
      operatingAirline: first.airline,
      sameAlliance: sameAlliance(profile.airline, first.airline),
      aircraft: first.aircraft,
      loadFactor: 0.82,
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

        {standby && (
          <StandbySummary
            offer={offer}
            mode={fareMode}
            cabin={offer.cabin}
            typicalRange={typicalRange}
            reportedLoads={reportedLoads}
            onReportedLoadsChange={setReportedLoads}
          />
        )}

        {standby && (
          <section aria-labelledby="backups-h" className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="backups-h" className="text-sm font-semibold">
                Backup flights
              </h3>
              <span className="text-xs text-muted-foreground">
                {odds < 0.7 ? "Odds are tight: keep a plan B" : "Ranked by your chances"}
              </span>
            </div>
            <BackupList query={backupQuery} selected={backups} onToggle={toggleBackup} />
          </section>
        )}

        <AddToTrip
          offer={offer}
          fareMode={fareMode}
          source={source}
          reportedLoads={Object.keys(reportedLoads).length ? reportedLoads : undefined}
          backups={backups}
          // The explore page stays mounted in the background; don't leave this dialog open there.
          onNavigate={() => onOpenChange(false)}
        />

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

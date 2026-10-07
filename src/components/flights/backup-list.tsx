"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/hooks/use-flights";
import type { BackupsResult } from "@/lib/api/backups";
import { useSkyPlan } from "@/lib/store";
import type { Cabin, FareMode, FlightOffer } from "@/lib/types";
import { formatDuration, formatMoney } from "@/lib/utils";

import { OddsText } from "./standby-panel";

const offerKey = (o: FlightOffer) => o.segments.map((s) => `${s.flightNumber}@${s.departAt}`).join("|");

export function useBackups(params: {
  from: string;
  to: string;
  date: string;
  cabin: Cabin;
  mode: FareMode;
  exclude: string[];
  enabled?: boolean;
}) {
  const profile = useSkyPlan((s) => s.staffProfile);
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    date: params.date,
    cabin: params.cabin,
    mode: params.mode,
    airline: profile.airline,
    years: String(profile.yearsOfService),
    relationship: profile.relationship,
    exclude: params.exclude.join(","),
  });
  return useQuery({
    queryKey: ["backups", search.toString()],
    queryFn: () => getJson<BackupsResult>(`/api/flights/backups?${search}`),
    enabled: params.enabled ?? true,
  });
}

/** Ranked alternatives; each can be toggled as a saved backup. */
export function BackupList({
  query,
  selected,
  onToggle,
  limit = 4,
}: {
  query: ReturnType<typeof useBackups>;
  selected: FlightOffer[];
  onToggle: (offer: FlightOffer) => void;
  limit?: number;
}) {
  if (query.isPending) {
    return (
      <div className="space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) return <p className="text-sm text-bad">Couldn&apos;t find backups: {query.error.message}</p>;
  const options = query.data.options.slice(0, limit);
  if (options.length === 0) return <p className="text-sm text-muted-foreground">No other flights found.</p>;

  const chosen = new Set(selected.map(offerKey));
  return (
    <ul className="divide-y rounded-md border">
      {options.map(({ offer, odds, total, dayOffset }) => {
        const first = offer.segments[0];
        const last = offer.segments.at(-1)!;
        const isOn = chosen.has(offerKey(offer));
        return (
          <li key={offerKey(offer)} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium tabular-nums">
                {dayOffset === 1 && <span className="mr-1 text-xs text-muted-foreground">Next day ·</span>}
                {first.departAt.slice(11, 16)}–{last.arriveAt.slice(11, 16)}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {offer.segments.map((s) => s.flightNumber).join("/")}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {offer.layovers.length === 0 ? "Nonstop" : `via ${offer.layovers.map((l) => l.airport).join(", ")}`} ·{" "}
                {formatDuration(offer.totalDurationMinutes)} · {formatMoney(total)}
              </p>
            </div>
            <OddsText odds={odds} className="text-sm font-semibold" />
            <Button
              size="icon"
              variant={isOn ? "secondary" : "outline"}
              className="size-8"
              aria-label={isOn ? "Remove backup" : "Keep as backup"}
              aria-pressed={isOn}
              onClick={() => onToggle(offer)}
            >
              {isOn ? <Check /> : <Plus />}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export { offerKey };

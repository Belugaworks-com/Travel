"use client";

import { ClipboardList } from "lucide-react";
import { useId } from "react";

import {
  checkInAdvice,
  oddsBand,
  standbyPriority,
  type ReportedLoads,
} from "@/lib/staff-travel/engine";
import { offerOdds, sameAlliance } from "@/lib/staff-travel/offer-odds";
import { useSkyPlan } from "@/lib/store";
import type { Cabin, FareMode, FlightOffer } from "@/lib/types";
import { cn } from "@/lib/utils";

const ODDS_STYLE = { good: "bg-good", fair: "bg-warn", poor: "bg-bad" } as const;
const ODDS_TEXT = { good: "text-good", fair: "text-warn", poor: "text-bad" } as const;

export function OddsMeter({ odds, className }: { odds: number; className?: string }) {
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-label="Estimated standby odds"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(odds * 100)}
    >
      <div
        className={cn("h-full rounded-full", ODDS_STYLE[oddsBand(odds)])}
        style={{ width: `${Math.max(4, odds * 100)}%` }}
      />
    </div>
  );
}

export function OddsText({ odds, className }: { odds: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", ODDS_TEXT[oddsBand(odds)], className)}>{Math.round(odds * 100)}%</span>
  );
}

const numberInput =
  "h-8 w-full rounded-md border bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Inputs for loads copied from a staff travel portal, one row per flight. */
export function ReportedLoadsFields({
  offer,
  value,
  onChange,
}: {
  offer: FlightOffer;
  value: Record<string, ReportedLoads>;
  onChange: (next: Record<string, ReportedLoads>) => void;
}) {
  const id = useId();
  const set = (flight: string, key: keyof ReportedLoads, raw: string) => {
    const current = value[flight];
    if (raw === "" && current) {
      const rest = { ...value };
      delete rest[flight];
      onChange(rest);
      return;
    }
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n)) return;
    onChange({ ...value, [flight]: { ...(current ?? { openSeats: 0, listedAhead: 0 }), [key]: n } });
  };
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
        <span>Flight</span>
        <span>Open seats</span>
        <span>Non-revs ahead</span>
      </div>
      {offer.segments.map((s) => (
        <div key={s.flightNumber} className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-2">
          <span className="font-mono text-xs">{s.flightNumber}</span>
          <label className="sr-only" htmlFor={`${id}-${s.flightNumber}-open`}>
            Open seats on {s.flightNumber}
          </label>
          <input
            id={`${id}-${s.flightNumber}-open`}
            type="number"
            inputMode="numeric"
            className={numberInput}
            value={value[s.flightNumber]?.openSeats ?? ""}
            onChange={(e) => set(s.flightNumber, "openSeats", e.target.value)}
          />
          <label className="sr-only" htmlFor={`${id}-${s.flightNumber}-ahead`}>
            Non-revs listed ahead of you on {s.flightNumber}
          </label>
          <input
            id={`${id}-${s.flightNumber}-ahead`}
            type="number"
            min={0}
            inputMode="numeric"
            className={numberInput}
            value={value[s.flightNumber]?.listedAhead ?? ""}
            onChange={(e) => set(s.flightNumber, "listedAhead", e.target.value)}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Copy these from your airline&apos;s staff travel portal for this cabin. Real loads replace the estimate.
      </p>
    </div>
  );
}

/** Standby priority, odds and check-in advice for an itinerary. */
export function StandbySummary({
  offer,
  mode,
  cabin,
  typicalRange,
  reportedLoads,
  onReportedLoadsChange,
}: {
  offer: FlightOffer;
  mode: FareMode;
  cabin: Cabin;
  typicalRange?: [number, number];
  reportedLoads: Record<string, ReportedLoads>;
  onReportedLoadsChange: (next: Record<string, ReportedLoads>) => void;
}) {
  const profile = useSkyPlan((s) => s.staffProfile);
  const first = offer.segments[0];
  const priority = standbyPriority(profile, mode, first.airline, sameAlliance(profile.airline, first.airline));
  const odds = offerOdds(offer, { mode, cabin, profile, typicalRange, reportedLoads });
  const usingReal = offer.segments.some((s) => reportedLoads[s.flightNumber]);

  return (
    <section aria-label="Standby" className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{priority.label}</h3>
          <p className="text-xs text-muted-foreground">{priority.detail}</p>
        </div>
        <p className="shrink-0 text-right">
          <OddsText odds={odds} className="block text-xl font-semibold" />
          <span className="text-[11px] text-muted-foreground">
            {usingReal ? "from your loads" : "estimated chance"}
          </span>
        </p>
      </div>
      <OddsMeter odds={odds} />
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
        {checkInAdvice(odds, "standby").map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <details className="group rounded-md border bg-muted/30 open:bg-transparent" open={usingReal}>
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium select-none">
          <ClipboardList className="size-3.5" />
          Have real loads? Enter them for exact odds
        </summary>
        <div className="px-3 pb-3">
          <ReportedLoadsFields offer={offer} value={reportedLoads} onChange={onReportedLoadsChange} />
        </div>
      </details>
    </section>
  );
}

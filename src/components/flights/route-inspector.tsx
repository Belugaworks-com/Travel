"use client";

import type { RouteInfo } from "@/lib/api/route-info";
import type { EnrichedOperator } from "@/lib/route-insights";
import { getAirport } from "@/lib/data/airports";
import { oddsBand, type OddsBand } from "@/lib/staff-travel/engine";
import { cn } from "@/lib/utils";

import { SourceNote } from "./source-note";

const BAND = {
  good: { label: "Good", dot: "bg-good", text: "text-good" },
  fair: { label: "Fair", dot: "bg-warn", text: "text-warn" },
  poor: { label: "Tight", dot: "bg-bad", text: "text-bad" },
} satisfies Record<OddsBand, { label: string; dot: string; text: string }>;

const pct = (x: number) => `${Math.round(x * 100)}%`;

function CabinSeats({ op }: { op: EnrichedOperator }) {
  if (!op.config) return <p className="text-xs text-muted-foreground">Cabin layout not published.</p>;
  const c = op.config;
  const rows = [
    { key: "first", label: "First", seats: c.first, layout: c.layout.first },
    { key: "business", label: "Business", seats: c.business, layout: c.layout.business },
    { key: "premium_economy", label: "Premium", seats: c.premium_economy, layout: c.layout.premium_economy },
    { key: "economy", label: "Economy", seats: c.economy, layout: c.layout.economy },
  ].filter((r) => r.seats > 0);
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-px overflow-hidden rounded-md border bg-border text-xs">
      {rows.map((r) => (
        <div key={r.key} className="bg-background px-2 py-1.5">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="font-medium tabular-nums">
            {r.seats}
            {r.layout && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{r.layout}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Operator({ op }: { op: EnrichedOperator }) {
  const band = op.standbyOdds === null ? null : BAND[oddsBand(op.standbyOdds)];
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {op.airlineName} <span className="font-mono text-xs text-muted-foreground">{op.flightNumber}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {op.aircraft}
            {op.approximateLayout && <span> · typical layout</span>}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs">
          <p className="tabular-nums">
            Load <span className="font-medium">{pct(Math.min(1, op.loadFactor.economy))}</span>
          </p>
          {band && (
            <p className={cn("flex items-center justify-end gap-1.5", band.text)}>
              <span className={cn("size-1.5 rounded-full", band.dot)} />
              Standby {band.label.toLowerCase()} · {pct(op.standbyOdds!)}
            </p>
          )}
        </div>
      </div>
      <CabinSeats op={op} />
    </li>
  );
}

export function RouteInspector({ info, operators }: { info: RouteInfo; operators: EnrichedOperator[] }) {
  if (operators.length === 0) {
    return (
      <section aria-labelledby="connections-h" className="px-4 py-3">
        <h3 id="connections-h" className="text-sm font-semibold">
          No nonstop · connect via
        </h3>
        <ul className="mt-2 divide-y rounded-md border">
          {info.connections.map((c) => (
            <li key={c.via} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                <span className="font-mono font-semibold">{c.via}</span>{" "}
                <span className="text-muted-foreground">{getAirport(c.via)?.city}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">{c.carriers.join(" · ")}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const odds = operators.map((op) => op.standbyOdds).filter((x): x is number => x !== null);
  const score = odds.length ? odds.reduce((a, b) => a + b, 0) / odds.length : null;
  const typicalLoad = operators.length
    ? operators.reduce((a, op) => a + op.loadFactor.economy, 0) / operators.length
    : null;
  const band = score === null ? null : BAND[oddsBand(score)];
  return (
    <section aria-labelledby="inspector-h">
      <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-2">
        <h3 id="inspector-h" className="text-sm font-semibold">
          Route inspector
        </h3>
        {band && typicalLoad !== null && (
          <p className={cn("text-xs", band.text)}>
            {band.label} standby odds · typical load {pct(Math.min(1, typicalLoad))}
          </p>
        )}
      </div>
      <ul className="divide-y border-y">
        {operators.map((op) => (
          <Operator key={op.airline} op={op} />
        ))}
      </ul>
      <div className="px-4 py-3">
        <SourceNote
          source={info.source}
          live={`Carriers from Aviationstack${operators.some((o) => o.liveAircraft) ? ", aircraft from Google Flights" : ""}. Loads and standby odds are estimates; enter real loads when you book.`}
          sample={`Sample schedule${operators.some((o) => o.liveAircraft) ? "; aircraft from Google Flights" : ""}. Loads and standby odds are estimates; enter real loads when you book.`}
        />
      </div>
    </section>
  );
}

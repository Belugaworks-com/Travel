"use client";

import { CityPanel } from "@/components/flights/city-panel";
import { WorldMap } from "@/components/map/world-map";
import { getAirport } from "@/lib/data/airports";
import { useSkyPlan } from "@/lib/store";

import { AppHeader } from "./app-header";

const QUICK_PICKS = ["LHR", "JFK", "DXB", "SIN", "SYD"];

function EmptyState() {
  const selectAirport = useSkyPlan((s) => s.selectAirport);
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 md:inset-x-auto md:top-3 md:bottom-auto md:left-3 md:w-80">
      <div className="pointer-events-auto rounded-xl border bg-background/95 p-4 shadow-lg shadow-foreground/5 backdrop-blur">
        <h1 className="text-base font-semibold tracking-tight">Where to?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an airport on the map to see its routes, fares and standby odds.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_PICKS.map((iata) => (
            <button
              key={iata}
              type="button"
              onClick={() => selectAirport(iata)}
              className="rounded-md border px-2 py-1 text-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]"
            >
              <span className="font-mono font-semibold">{iata}</span>{" "}
              <span className="text-muted-foreground">{getAirport(iata)?.city}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SkyPlanApp() {
  const selected = useSkyPlan((s) => s.selected);
  return (
    <div className="flex h-full flex-col">
      <AppHeader />
      <main className="relative flex-1 overflow-hidden">
        <WorldMap />
        {selected ? <CityPanel /> : <EmptyState />}
      </main>
    </div>
  );
}

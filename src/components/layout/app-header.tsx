"use client";

import { CalendarRange, Compass, Globe2, Map as MapIcon, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSkyPlan } from "@/lib/store";
import { CABIN_LABEL, CABINS, FARE_MODE_LABEL, type Cabin, type FareMode } from "@/lib/types";

import { Logo } from "./logo";

const FARE_MODE_HINT: Record<FareMode, string> = {
  commercial: "Full published fare",
  id50: "Staff fare: 50% off base fare, confirmed seat",
  id90: "Staff fare: 90% off base fare, standby",
  zed: "Interline staff fare by distance zone, standby",
};

function FareModeToggle() {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const setFareMode = useSkyPlan((s) => s.setFareMode);
  return (
    <ToggleGroup
      type="single"
      value={fareMode}
      onValueChange={(v) => v && setFareMode(v as FareMode)}
      aria-label="Fare type"
    >
      {(Object.keys(FARE_MODE_LABEL) as FareMode[]).map((mode) => (
        <ToggleGroupItem key={mode} value={mode} title={FARE_MODE_HINT[mode]}>
          {FARE_MODE_LABEL[mode]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const fieldClass =
  "h-8 rounded-md border bg-background px-2 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function TripControls() {
  const cabin = useSkyPlan((s) => s.cabin);
  const setCabin = useSkyPlan((s) => s.setCabin);
  const travelDate = useSkyPlan((s) => s.travelDate);
  const setTravelDate = useSkyPlan((s) => s.setTravelDate);
  // Rendered in both the desktop and mobile rows, so ids must be unique.
  const id = useId();
  return (
    <>
      <label className="sr-only" htmlFor={`${id}-date`}>
        Travel date
      </label>
      <input
        id={`${id}-date`}
        type="date"
        className={`${fieldClass} font-mono tabular-nums`}
        value={travelDate}
        onChange={(e) => e.target.value && setTravelDate(e.target.value)}
      />
      <label className="sr-only" htmlFor={`${id}-cabin`}>
        Cabin
      </label>
      <select
        id={`${id}-cabin`}
        className={fieldClass}
        value={cabin}
        onChange={(e) => setCabin(e.target.value as Cabin)}
      >
        {CABINS.map((c) => (
          <option key={c} value={c}>
            {CABIN_LABEL[c]}
          </option>
        ))}
      </select>
    </>
  );
}

const NAV = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/planner", label: "Planner", icon: CalendarRange },
] as const;

function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppHeader() {
  const projection = useSkyPlan((s) => s.projection);
  const setProjection = useSkyPlan((s) => s.setProjection);
  const { resolvedTheme, setTheme } = useTheme();
  const explore = usePathname() === "/";

  return (
    <header className="z-20 shrink-0 border-b bg-background">
      <div className="flex h-14 items-center gap-3 px-4">
        <Logo />
        <MainNav />
        <div className="ml-3 hidden items-center gap-2 lg:flex">
          <FareModeToggle />
          {explore && <TripControls />}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {explore && (
            <ToggleGroup
              type="single"
              value={projection}
              onValueChange={(v) => v && setProjection(v as "globe" | "mercator")}
              aria-label="Map projection"
            >
              <ToggleGroupItem value="globe" aria-label="3D globe">
                <Globe2 />
                <span className="hidden sm:inline">Globe</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="mercator" aria-label="Flat map">
                <MapIcon />
                <span className="hidden sm:inline">2D</span>
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2.5 lg:hidden">
        <FareModeToggle />
        {explore && <TripControls />}
      </div>
    </header>
  );
}

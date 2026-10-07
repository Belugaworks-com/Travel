"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  BedDouble,
  Car,
  CircleAlert,
  Download,
  Info,
  Plane,
  Plus,
  StickyNote,
  Ticket,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AIRPORTS, getAirport } from "@/lib/data/airports";
import { formatDay } from "@/lib/planner/format";
import { buildIcs } from "@/lib/planner/ics";
import { useActiveTrip, usePlanner } from "@/lib/planner/store";
import { checkTrip, locationByDay, tripRange, tripTotals, type PlanWarning } from "@/lib/planner/timeline";
import type { Trip, TripItem } from "@/lib/planner/types";
import { useSkyPlan } from "@/lib/store";
import { FARE_MODE_LABEL } from "@/lib/types";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

import { FlightFinderDialog } from "./flight-finder-dialog";
import { ItemChip } from "./item-card";
import { ItemDialog, type EditableKind } from "./item-dialog";
import { AgendaView, MonthView, WeekView } from "./views";

type View = "agenda" | "week" | "month";
type Dialog =
  | { type: "flight"; day: string }
  | { type: "item"; kind: EditableKind; day: string; item?: Extract<TripItem, { kind: EditableKind }> }
  | null;

const field =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const SORTED = [...AIRPORTS].sort((a, b) => a.city.localeCompare(b.city));
const today = () => new Date().toISOString().slice(0, 10);

function NewTripForm({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const createTrip = usePlanner((s) => s.createTrip);
  const [name, setName] = useState("");
  const [home, setHome] = useState("LHR");
  const id = useId();
  return (
    <form
      className={cn("grid gap-3", compact ? "" : "sm:grid-cols-[1fr_12rem_auto] sm:items-end")}
      onSubmit={(e) => {
        e.preventDefault();
        createTrip(name.trim() || "New trip", home);
        setName("");
        onDone?.();
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          Trip name
        </label>
        <input id={`${id}-name`} className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tokyo in March" />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-home`} className="text-sm font-medium">
          Home airport
        </label>
        <select id={`${id}-home`} className={field} value={home} onChange={(e) => setHome(e.target.value)}>
          {SORTED.map((a) => (
            <option key={a.iata} value={a.iata}>
              {a.city} ({a.iata})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="signal">
        <Plus /> Create trip
      </Button>
    </form>
  );
}

function TripList() {
  const trips = usePlanner((s) => s.trips);
  const active = useActiveTrip();
  const setActive = usePlanner((s) => s.setActiveTrip);
  const [creating, setCreating] = useState(false);
  return (
    <nav aria-label="Trips" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Trips</h2>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCreating((c) => !c)}>
          <Plus /> New
        </Button>
      </div>
      {creating && <NewTripForm compact onDone={() => setCreating(false)} />}
      <ul className="space-y-1">
        {trips.map((t) => {
          const range = tripRange(t);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setActive(t.id)}
                aria-current={t.id === active?.id ? "true" : undefined}
                className="w-full rounded-md px-2.5 py-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=true]:bg-muted"
              >
                <span className="block truncate text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {range ? `${formatDay(range[0])} – ${formatDay(range[1])}` : "No plans yet"} · {t.items.length} item
                  {t.items.length !== 1 && "s"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const WARNING_STYLE = {
  error: { icon: CircleAlert, className: "text-bad" },
  warn: { icon: AlertTriangle, className: "text-warn" },
  info: { icon: Info, className: "text-muted-foreground" },
};

function Warnings({ warnings }: { warnings: PlanWarning[] }) {
  if (warnings.length === 0) return null;
  const jump = (w: PlanWarning) => {
    const el = document.getElementById(w.itemIds[0] ? `item-${w.itemIds[0]}` : `day-${w.day}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <section aria-labelledby="checks-h" className="rounded-lg border">
      <h3 id="checks-h" className="border-b px-3 py-2 text-sm font-semibold">
        Plan checks <span className="font-normal text-muted-foreground">· {warnings.length}</span>
      </h3>
      <ul className="max-h-48 divide-y overflow-y-auto">
        {warnings.map((w, i) => {
          const { icon: Icon, className } = WARNING_STYLE[w.level];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => jump(w)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs outline-none hover:bg-accent/60 focus-visible:bg-accent"
              >
                <Icon className={cn("mt-px size-3.5 shrink-0", className)} />
                <span>
                  {w.day && <span className="mr-1.5 font-medium tabular-nums">{formatDay(w.day)}</span>}
                  {w.message}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function downloadIcs(trip: Trip) {
  const blob = new Blob([buildIcs(trip)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trip.name.replace(/[^\w\- ]+/g, "").trim() || "trip"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

const ADD_BUTTONS: { kind: "flight" | EditableKind; label: string; icon: typeof Plane }[] = [
  { kind: "flight", label: "Flight", icon: Plane },
  { kind: "stay", label: "Stay", icon: BedDouble },
  { kind: "activity", label: "Activity", icon: Ticket },
  { kind: "transfer", label: "Transfer", icon: Car },
  { kind: "note", label: "Note", icon: StickyNote },
];

function TripWorkspace({ trip }: { trip: Trip }) {
  const fareMode = useSkyPlan((s) => s.fareMode);
  const renameTrip = usePlanner((s) => s.renameTrip);
  const setHome = usePlanner((s) => s.setHome);
  const deleteTrip = usePlanner((s) => s.deleteTrip);
  const moveToDay = usePlanner((s) => s.moveToDay);
  const [view, setView] = useState<View>("agenda");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dragging, setDragging] = useState<TripItem | null>(null);
  const id = useId();

  const warnings = useMemo(() => checkTrip(trip), [trip]);
  const totals = useMemo(() => tripTotals(trip), [trip]);
  const range = tripRange(trip);
  const where = useMemo(() => locationByDay(trip), [trip]);
  const highlighted = useMemo(
    () => new Set(warnings.filter((w) => w.level !== "info").flatMap((w) => w.itemIds)),
    [warnings],
  );
  const firstDay = range?.[0] ?? today();
  const lastDay = range?.[1] ?? today();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const over = e.over?.id;
    if (typeof over === "string" && over.startsWith("day:")) moveToDay(trip.id, String(e.active.id), over.slice(4));
  };

  const open = (kind: "flight" | EditableKind, day: string) =>
    setDialog(kind === "flight" ? { type: "flight", day } : { type: "item", kind, day });

  const edit = (item: TripItem) => {
    if (item.kind === "flight") {
      setView("agenda");
      requestAnimationFrame(() =>
        document.getElementById(`item-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
      return;
    }
    setDialog({ type: "item", kind: item.kind, day: item.start.slice(0, 10), item });
  };

  const lastLocation = where.get(lastDay) ?? trip.home;
  const tzFor = (day: string) => getAirport(where.get(day) ?? trip.home ?? "LHR")?.tz ?? "UTC";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-name`} className="sr-only">
            Trip name
          </label>
          <input
            id={`${id}-name`}
            value={trip.name}
            onChange={(e) => renameTrip(trip.id, e.target.value)}
            className="w-full rounded-md bg-transparent text-2xl font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {range ? `${formatDay(range[0])} – ${formatDay(range[1])}` : "No dates yet"}
            <span aria-hidden>·</span>
            <label htmlFor={`${id}-home`}>Home</label>
            <select
              id={`${id}-home`}
              value={trip.home ?? ""}
              onChange={(e) => setHome(trip.id, e.target.value || undefined)}
              className="rounded border-none bg-transparent font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">None</option>
              {SORTED.map((a) => (
                <option key={a.iata} value={a.iata}>
                  {a.iata}
                </option>
              ))}
            </select>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => downloadIcs(trip)} disabled={trip.items.length === 0}>
            <Download /> Export .ics
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:text-bad"
            aria-label="Delete trip"
            onClick={() => {
              if (window.confirm(`Delete "${trip.name}"? This can't be undone.`)) deleteTrip(trip.id);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {totals.flights > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 px-4 py-3 sm:grid-cols-5">
          <Stat label="Flights" value={String(totals.flights)} />
          <Stat label="In the air" value={formatDuration(totals.flightMinutes)} />
          <Stat label="Distance" value={`${totals.miles.toLocaleString()} mi`} />
          <Stat label="Flights cost" value={formatMoney(totals.planned)} />
          <Stat label="Saved vs commercial" value={totals.savings > 0 ? formatMoney(totals.savings) : "—"} />
        </dl>
      )}

      <Warnings warnings={warnings} />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as View)} aria-label="View">
          <ToggleGroupItem value="agenda">Agenda</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {ADD_BUTTONS.map(({ kind, label, icon: Icon }) => (
            <Button
              key={kind}
              size="sm"
              variant={kind === "flight" ? "signal" : "outline"}
              onClick={() => open(kind, kind === "flight" ? lastDay : firstDay)}
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
      </div>

      {trip.items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">Start with a flight</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Search here, or use <Link href="/" className="underline underline-offset-2">Explore</Link> and pick
            &ldquo;Add to trip&rdquo; when you book. Prices use {FARE_MODE_LABEL[fareMode]}.
          </p>
          <Button className="mt-4" variant="signal" onClick={() => open("flight", today())}>
            <Plane /> Find a flight
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDragging(trip.items.find((i) => i.id === e.active.id) ?? null)}
          onDragCancel={() => setDragging(null)}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: {
              draggable: "Press space to pick up, use arrow keys to move to another day, and space again to drop.",
            },
          }}
        >
          {view === "agenda" && (
            <AgendaView
              trip={trip}
              warnings={warnings}
              highlighted={highlighted}
              onEdit={edit}
              onAddOnDay={(day) => open("activity", day)}
            />
          )}
          {view === "week" && <WeekView trip={trip} startDay={firstDay} onSelect={edit} />}
          {view === "month" && <MonthView trip={trip} startDay={firstDay} onSelect={edit} />}
          <DragOverlay>{dragging && <div className="w-48"><ItemChip item={dragging} onSelect={() => {}} /></div>}</DragOverlay>
        </DndContext>
      )}

      {dialog?.type === "flight" && (
        <FlightFinderDialog
          tripId={trip.id}
          defaultFrom={lastLocation}
          defaultTo={lastLocation === trip.home ? undefined : trip.home}
          defaultDay={dialog.day}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
      {dialog?.type === "item" && (
        <ItemDialog
          tripId={trip.id}
          kind={dialog.kind}
          item={dialog.item}
          defaultDay={dialog.day}
          defaultTz={tzFor(dialog.day)}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
    </div>
  );
}

export default function PlannerApp() {
  const trips = usePlanner((s) => s.trips);
  const active = useActiveTrip();
  const setActive = usePlanner((s) => s.setActiveTrip);

  return (
    <div className="flex h-full flex-col">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        {trips.length === 0 ? (
          <div className="mx-auto max-w-2xl px-4 py-16">
            <h1 className="text-2xl font-semibold tracking-tight">Plan a trip</h1>
            <p className="mt-2 max-w-prose text-muted-foreground">
              Put flights, stays and plans on one timeline. SkyPlan checks connections, flags nights without a bed,
              tracks standby odds and backups, and exports everything to your calendar.
            </p>
            <div className="mt-8">
              <NewTripForm />
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <TripList />
              </div>
            </aside>
            <div className="space-y-2 lg:hidden">
              <label htmlFor="trip-picker" className="sr-only">
                Trip
              </label>
              <select
                id="trip-picker"
                className={field}
                value={active?.id}
                onChange={(e) => setActive(e.target.value)}
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">New trip</summary>
                <div className="pt-3">
                  <NewTripForm compact />
                </div>
              </details>
            </div>
            {active && <TripWorkspace key={active.id} trip={active} />}
          </div>
        )}
      </main>
    </div>
  );
}

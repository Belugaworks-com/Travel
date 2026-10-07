"use client";

import { useDroppable } from "@dnd-kit/core";
import { BedDouble, ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getAirport } from "@/lib/data/airports";
import { formatDay, formatLongDay, formatMonth } from "@/lib/planner/format";
import { groupByDay, locationByDay, sortItems, type PlanWarning } from "@/lib/planner/timeline";
import type { Trip, TripItem } from "@/lib/planner/types";
import { addDaysLocal, dateOf, eachDay } from "@/lib/time";
import { cn } from "@/lib/utils";

import { ItemCard, ItemChip } from "./item-card";

export const dayDropId = (day: string) => `day:${day}`;

function DayDrop({ day, className, children }: { day: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day) });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "bg-signal/10 ring-2 ring-signal/40")}>
      {children}
    </div>
  );
}

const addDay = (day: string, n: number) => dateOf(addDaysLocal(`${day}T00:00`, n));

function stayFor(trip: Trip, day: string) {
  return trip.items.find(
    (i) => i.kind === "stay" && dateOf(i.start) <= day && (i.end ? dateOf(i.end) > day : dateOf(i.start) === day),
  );
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export function AgendaView({
  trip,
  warnings,
  highlighted,
  onEdit,
  onAddOnDay,
}: {
  trip: Trip;
  warnings: PlanWarning[];
  highlighted: Set<string>;
  onEdit: (item: TripItem) => void;
  onAddOnDay: (day: string) => void;
}) {
  const days = groupByDay(trip);
  const where = locationByDay(trip);
  return (
    <ol className="space-y-6">
      {[...days].map(([day, items]) => {
        const city = where.get(day);
        const stay = stayFor(trip, day);
        const dayWarnings = warnings.filter((w) => w.day === day && w.itemIds.length === 0);
        return (
          <li key={day} id={`day-${day}`} className="scroll-mt-20">
            <DayDrop day={day} className="rounded-xl p-1 transition-colors">
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 pb-2">
                <h3 className="text-sm font-semibold">{formatLongDay(day)}</h3>
                {city && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {getAirport(city)?.city ?? city}
                    {city === trip.home && " · home"}
                  </span>
                )}
                {stay && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BedDouble className="size-3" />
                    {stay.title}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => onAddOnDay(day)}
                >
                  <Plus /> Add
                </Button>
              </header>
              {dayWarnings.map((w) => (
                <p key={w.message} className="mx-1 mb-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {w.message}
                </p>
              ))}
              {items.length === 0 ? (
                <p className="mx-1 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
                  Free day. Drag something here, or add a plan.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      tripId={trip.id}
                      item={item}
                      onEdit={onEdit}
                      highlighted={highlighted.has(item.id)}
                    />
                  ))}
                </div>
              )}
            </DayDrop>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------

/** Monday of the week containing `day`. */
function weekStart(day: string) {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDay(day, -((dow + 6) % 7));
}

function itemsOn(trip: Trip, day: string) {
  return sortItems(trip.items.filter((i) => dateOf(i.start) === day));
}

export function WeekView({
  trip,
  startDay,
  onSelect,
}: {
  trip: Trip;
  startDay: string;
  onSelect: (item: TripItem) => void;
}) {
  const [monday, setMonday] = useState(weekStart(startDay));
  const days = eachDay(monday, addDay(monday, 6));
  const where = locationByDay(trip);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-8" aria-label="Previous week" onClick={() => setMonday(addDay(monday, -7))}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" className="size-8" aria-label="Next week" onClick={() => setMonday(addDay(monday, 7))}>
          <ChevronRight />
        </Button>
        <h3 className="text-sm font-semibold">
          {formatDay(days[0])} – {formatDay(days[6])}
        </h3>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[56rem] grid-cols-7 gap-2">
          {days.map((day) => (
            <DayDrop key={day} day={day} className="flex min-h-48 flex-col gap-1 rounded-lg border bg-card p-2 transition-colors">
              <p className="text-xs font-semibold">{formatDay(day)}</p>
              {where.get(day) && (
                <p className="truncate text-[11px] text-muted-foreground">{getAirport(where.get(day)!)?.city}</p>
              )}
              <div className="mt-1 flex flex-col gap-1">
                {itemsOn(trip, day).map((item) => (
                  <ItemChip key={item.id} item={item} onSelect={onSelect} />
                ))}
              </div>
            </DayDrop>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({
  trip,
  startDay,
  onSelect,
}: {
  trip: Trip;
  startDay: string;
  onSelect: (item: TripItem) => void;
}) {
  const [month, setMonth] = useState(`${startDay.slice(0, 7)}-01`);
  const first = weekStart(month);
  const days = eachDay(first, addDay(first, 41));
  const shiftMonth = (n: number) => {
    const d = new Date(`${month}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 10));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-8" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" className="size-8" aria-label="Next month" onClick={() => shiftMonth(1)}>
          <ChevronRight />
        </Button>
        <h3 className="text-sm font-semibold">{formatMonth(month)}</h3>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[42rem] grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const items = itemsOn(trip, day);
            const inMonth = day.slice(0, 7) === month.slice(0, 7);
            return (
              <DayDrop key={day} day={day} className={cn("min-h-24 bg-card p-1 transition-colors", !inMonth && "bg-muted/30")}>
                <p className={cn("px-1 text-[11px] tabular-nums", inMonth ? "font-medium" : "text-muted-foreground")}>
                  {Number(day.slice(8))}
                </p>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {items.slice(0, 3).map((item) => (
                    <ItemChip key={item.id} item={item} onSelect={onSelect} />
                  ))}
                  {items.length > 3 && (
                    <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 3} more</p>
                  )}
                </div>
              </DayDrop>
            );
          })}
        </div>
      </div>
    </div>
  );
}

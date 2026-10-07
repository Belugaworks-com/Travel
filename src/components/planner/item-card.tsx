"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  ArrowRight,
  BedDouble,
  CalendarPlus,
  Car,
  ClipboardList,
  GripVertical,
  LifeBuoy,
  MapPin,
  Pencil,
  Plane,
  StickyNote,
  Trash2,
  Ticket,
} from "lucide-react";
import { useState } from "react";

import { OddsText } from "@/components/flights/standby-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dayShift, flightPrice, zoneAbbr } from "@/lib/planner/format";
import { googleCalendarUrl, itemEvents } from "@/lib/planner/ics";
import { usePlanner } from "@/lib/planner/store";
import { itemStart, segmentInstants } from "@/lib/planner/timeline";
import { FLIGHT_STATUS_LABEL, type FlightItem, type FlightStatus, type TripItem } from "@/lib/planner/types";
import { offerOdds } from "@/lib/staff-travel/offer-odds";
import { useSkyPlan } from "@/lib/store";
import { daysBetween, dateOf, timeOf } from "@/lib/time";
import { FARE_MODE_LABEL } from "@/lib/types";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

import { BackupsDialog } from "./backups-dialog";
import { LoadsDialog } from "./loads-dialog";

const KIND_ICON = { flight: Plane, stay: BedDouble, activity: Ticket, transfer: Car, note: StickyNote } as const;

const STATUS_TONE: Record<FlightStatus, string> = {
  planned: "text-muted-foreground",
  listed: "text-warn",
  confirmed: "text-good",
  checked_in: "text-good",
  boarded: "text-good",
  denied: "text-bad",
  cancelled: "text-muted-foreground line-through",
};

type Draggable = ReturnType<typeof useDraggable>;

function DragHandle({ drag, label }: { drag: Draggable; label: string }) {
  const { attributes, listeners, setActivatorNodeRef } = drag;
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label={`Move ${label} to another day`}
      className="-ml-1 grid h-8 w-5 shrink-0 cursor-grab touch-none place-items-center rounded text-muted-foreground/60 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

function FlightBody({ tripId, item }: { tripId: string; item: FlightItem }) {
  const profile = useSkyPlan((s) => s.staffProfile);
  const updateItem = usePlanner((s) => s.updateItem);
  const [dialog, setDialog] = useState<"loads" | "backups" | null>(null);
  const first = item.segments[0];
  const last = item.segments.at(-1)!;
  const times = segmentInstants(item.segments);
  const standby = item.fareMode === "id90" || item.fareMode === "zed";
  const asOffer = {
    id: item.id,
    segments: item.segments,
    layovers: item.layovers,
    totalDurationMinutes: (times.at(-1)!.arrive - times[0].depart) / 60_000,
    cabin: item.cabin,
    price: item.price,
    currency: item.currency,
    fare: item.fare,
  };
  const odds = standby
    ? offerOdds(asOffer, { mode: item.fareMode, cabin: item.cabin, profile, reportedLoads: item.reportedLoads })
    : null;
  const hasLoads = Boolean(item.reportedLoads && Object.keys(item.reportedLoads).length);
  const shift = dayShift(first.departAt, last.arriveAt);

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="flex items-center gap-1.5 font-semibold tabular-nums">
          {timeOf(first.departAt)}
          <span className="text-[10px] font-normal text-muted-foreground">{zoneAbbr(item.tz, times[0].depart)}</span>
          <ArrowRight className="size-3 text-muted-foreground" />
          {timeOf(last.arriveAt)}
          {shift && <sup className="text-[10px] text-warn">{shift}</sup>}
        </p>
        <p className="font-mono text-sm font-medium">
          {first.from} → {last.to}
        </p>
        <span className={cn("text-xs font-medium", STATUS_TONE[item.status])}>{FLIGHT_STATUS_LABEL[item.status]}</span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {[...new Set(item.segments.map((s) => s.airlineName))].join(" + ")} ·{" "}
        <span className="font-mono">{item.segments.map((s) => s.flightNumber).join(" / ")}</span> ·{" "}
        {formatDuration(asOffer.totalDurationMinutes)}
        {item.layovers.length > 0 && ` · via ${item.layovers.map((l) => `${l.airport} ${formatDuration(l.durationMinutes)}`).join(", ")}`}
      </p>
      <p className="truncate text-xs text-muted-foreground">{item.segments.map((s) => s.aircraft).join(" / ")}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{FARE_MODE_LABEL[item.fareMode]}</Badge>
        <span className="text-sm font-semibold tabular-nums">{formatMoney(flightPrice(item), item.currency)}</span>
        {odds !== null && (
          <span className="text-xs text-muted-foreground">
            · <OddsText odds={odds} className="font-semibold" /> {hasLoads ? "from loads" : "est."}
          </span>
        )}
        {item.backups.length > 0 && (
          <span className="text-xs text-muted-foreground">
            · {item.backups.length} backup{item.backups.length > 1 && "s"}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor={`status-${item.id}`}>
          Status
        </label>
        <select
          id={`status-${item.id}`}
          value={item.status}
          onChange={(e) => updateItem(tripId, item.id, { status: e.target.value as FlightStatus })}
          className="h-7 rounded-md border bg-background px-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {Object.entries(FLIGHT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {standby && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDialog("loads")}>
            <ClipboardList /> Loads
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDialog("backups")}>
          <LifeBuoy /> Backups
        </Button>
      </div>

      {dialog === "loads" && (
        <LoadsDialog tripId={tripId} item={item} offer={asOffer} onOpenChange={(o) => !o && setDialog(null)} />
      )}
      {dialog === "backups" && (
        <BackupsDialog tripId={tripId} item={item} onOpenChange={(o) => !o && setDialog(null)} />
      )}
    </>
  );
}

function OtherBody({ item }: { item: Exclude<TripItem, FlightItem> }) {
  const nights = item.kind === "stay" && item.end ? daysBetween(dateOf(item.start), dateOf(item.end)) : 0;
  const place = item.kind === "stay" ? item.place : item.kind === "note" ? undefined : item.place;
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {!item.allDay && item.kind !== "note" && (
          <span className="font-semibold tabular-nums">
            {timeOf(item.start)}
            {item.end && item.kind !== "stay" && `–${timeOf(item.end)}`}
          </span>
        )}
        <span className="font-medium">{item.title}</span>
        {item.kind === "stay" && nights > 0 && (
          <span className="text-xs text-muted-foreground">
            {nights} night{nights > 1 && "s"} · out {dateOf(item.end!)} {timeOf(item.end!)}
          </span>
        )}
      </p>
      {place && place !== item.title && (
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" /> {place}
        </p>
      )}
      {item.notes && <p className="mt-1 text-xs whitespace-pre-line text-muted-foreground">{item.notes}</p>}
    </>
  );
}

export function ItemCard({
  tripId,
  item,
  onEdit,
  highlighted,
}: {
  tripId: string;
  item: TripItem;
  onEdit: (item: TripItem) => void;
  highlighted?: boolean;
}) {
  const removeItem = usePlanner((s) => s.removeItem);
  const drag = useDraggable({ id: item.id });
  const { setNodeRef, isDragging } = drag;
  const Icon = KIND_ICON[item.kind];
  const events = itemEvents(item);
  const label = item.kind === "flight" ? item.segments.map((s) => s.flightNumber).join("/") : item.title;

  return (
    <article
      ref={setNodeRef}
      id={`item-${item.id}`}
      data-start={itemStart(item)}
      className={cn(
        "group flex gap-2 rounded-lg border bg-card p-3 transition-shadow",
        isDragging && "opacity-40",
        highlighted && "border-warn/60 ring-2 ring-warn/20",
      )}
    >
      <DragHandle drag={drag} label={label} />
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
          item.kind === "flight" ? "bg-signal/15 text-signal" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {item.kind === "flight" ? <FlightBody tripId={tripId} item={item} /> : <OtherBody item={item} />}
      </div>
      <div className="-mt-1 -mr-1 flex shrink-0 items-start gap-0.5 self-start opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {item.kind !== "flight" && (
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Edit ${label}`} onClick={() => onEdit(item)}>
            <Pencil className="size-3.5" />
          </Button>
        )}
        <Button asChild variant="ghost" size="icon" className="size-7">
          <a href={googleCalendarUrl(events[0])} target="_blank" rel="noreferrer" aria-label={`Add ${label} to Google Calendar`}>
            <CalendarPlus className="size-3.5" />
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:text-bad"
          aria-label={`Remove ${label}`}
          onClick={() => removeItem(tripId, item.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </article>
  );
}

/** Compact chip for week and month views. */
export function ItemChip({ item, onSelect }: { item: TripItem; onSelect: (item: TripItem) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const Icon = KIND_ICON[item.kind];
  const text =
    item.kind === "flight"
      ? `${item.segments[0].from}→${item.segments.at(-1)!.to}`
      : item.title;
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "flex w-full touch-none items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        item.kind === "flight" ? "bg-signal/15 text-foreground" : "bg-muted text-foreground",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
    >
      <Icon className="size-3 shrink-0 text-muted-foreground" />
      {!item.allDay && item.kind !== "stay" && <span className="tabular-nums text-muted-foreground">{timeOf(item.start)}</span>}
      <span className="truncate font-medium">{text}</span>
    </button>
  );
}

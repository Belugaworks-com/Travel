"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { zoneOptions } from "@/lib/planner/format";
import { usePlanner, type NewItem } from "@/lib/planner/store";
import type { ActivityItem, NoteItem, StayItem, TripItem } from "@/lib/planner/types";
import { dateOf, timeOf } from "@/lib/time";

export type EditableKind = "stay" | "activity" | "transfer" | "note";

const KIND_TITLE: Record<EditableKind, string> = {
  stay: "Stay",
  activity: "Activity",
  transfer: "Transfer",
  note: "Note",
};

const field =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Editable = StayItem | ActivityItem | NoteItem;

/** Add or edit a stay, activity, transfer or note. */
export function ItemDialog({
  tripId,
  kind,
  item,
  defaultDay,
  defaultTz,
  onOpenChange,
}: {
  tripId: string;
  kind: EditableKind;
  item?: Editable;
  defaultDay: string;
  defaultTz: string;
  onOpenChange: (open: boolean) => void;
}) {
  const addItem = usePlanner((s) => s.addItem);
  const updateItem = usePlanner((s) => s.updateItem);
  const id = useId();
  const zones = zoneOptions();

  const [title, setTitle] = useState(item?.title ?? "");
  const [place, setPlace] = useState(item && item.kind !== "note" ? (item.place ?? "") : "");
  const [address, setAddress] = useState(item?.kind === "stay" ? (item.address ?? "") : "");
  const [startDay, setStartDay] = useState(item ? dateOf(item.start) : defaultDay);
  const [startTime, setStartTime] = useState(item && !item.allDay ? timeOf(item.start) : kind === "stay" ? "15:00" : "10:00");
  const [endDay, setEndDay] = useState(item?.end ? dateOf(item.end) : kind === "stay" ? nextDay(defaultDay) : defaultDay);
  const [endTime, setEndTime] = useState(item?.end ? timeOf(item.end) : kind === "stay" ? "11:00" : "12:00");
  const [allDay, setAllDay] = useState(item?.allDay ?? kind === "note");
  const [tz, setTz] = useState(item?.tz ?? defaultTz);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const hasEnd = kind !== "note" && !allDay;
  const save = () => {
    const name = title.trim() || (kind === "stay" ? place.trim() : "");
    if (!name) return setError(kind === "stay" ? "Add the hotel or place name." : "Add a title.");
    const start = `${startDay}T${allDay ? "00:00" : startTime}`;
    const end = hasEnd ? `${endDay}T${endTime}` : undefined;
    if (end && end <= start) return setError("The end must be after the start.");
    if (kind === "stay" && endDay <= startDay) return setError("Check-out must be at least a day after check-in.");

    const base = { title: name, start, end, tz, endTz: tz, allDay: kind === "note" ? true : allDay, notes: notes.trim() || undefined };
    const next =
      kind === "stay"
        ? { ...base, kind, place: place.trim() || name, address: address.trim() || undefined }
        : kind === "note"
          ? { ...base, kind }
          : { ...base, kind, place: place.trim() || undefined };
    if (item) updateItem(tripId, item.id, next as Partial<TripItem>);
    else addItem(tripId, next as NewItem);
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit" : "Add"} {KIND_TITLE[kind].toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {kind === "stay"
              ? "Nights covered by a stay stop showing as missing."
              : "Times are local to where it happens."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-2">
            <label htmlFor={`${id}-title`} className="text-sm font-medium">
              {kind === "stay" ? "Hotel or place" : "Title"}
            </label>
            <input id={`${id}-title`} className={field} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          {kind !== "note" && (
            <div className="grid gap-2">
              <label htmlFor={`${id}-place`} className="text-sm font-medium">
                {kind === "stay" ? "Neighbourhood or city" : "Where"}
              </label>
              <input id={`${id}-place`} className={field} value={place} onChange={(e) => setPlace(e.target.value)} />
            </div>
          )}
          {kind === "stay" && (
            <div className="grid gap-2">
              <label htmlFor={`${id}-address`} className="text-sm font-medium">
                Address
              </label>
              <input id={`${id}-address`} className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          )}

          {kind !== "note" && kind !== "stay" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-signal" />
              No set time
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label htmlFor={`${id}-sd`} className="text-sm font-medium">
                {kind === "stay" ? "Check-in" : kind === "note" ? "Day" : "Starts"}
              </label>
              <input id={`${id}-sd`} type="date" className={field} value={startDay} onChange={(e) => setStartDay(e.target.value)} />
            </div>
            {!allDay && (
              <div className="grid gap-2">
                <label htmlFor={`${id}-st`} className="text-sm font-medium">
                  Time
                </label>
                <input id={`${id}-st`} type="time" className={field} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            )}
          </div>
          {hasEnd && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <label htmlFor={`${id}-ed`} className="text-sm font-medium">
                  {kind === "stay" ? "Check-out" : "Ends"}
                </label>
                <input id={`${id}-ed`} type="date" className={field} value={endDay} onChange={(e) => setEndDay(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label htmlFor={`${id}-et`} className="text-sm font-medium">
                  Time
                </label>
                <input id={`${id}-et`} type="time" className={field} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}
          {kind !== "note" && (
            <div className="grid gap-2">
              <label htmlFor={`${id}-tz`} className="text-sm font-medium">
                Time zone
              </label>
              <select id={`${id}-tz`} className={field} value={tz} onChange={(e) => setTz(e.target.value)}>
                {!zones.some((z) => z.value === tz) && <option value={tz}>{tz}</option>}
                {zones.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor={`${id}-notes`} className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id={`${id}-notes`}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{item ? "Save" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function nextDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

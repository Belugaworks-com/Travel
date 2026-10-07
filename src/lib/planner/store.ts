"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getAirport } from "@/lib/data/airports";
import { addDaysLocal, daysBetween, dateOf } from "@/lib/time";
import type { FlightOffer } from "@/lib/types";

import type { FlightItem, Trip, TripItem } from "./types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

/** Build a flight item from a search result. */
export function flightItemFromOffer(
  offer: FlightOffer,
  opts: Pick<FlightItem, "fareMode" | "source"> & Partial<Pick<FlightItem, "status" | "reportedLoads" | "backups">>,
): Omit<FlightItem, "id" | "order"> {
  const first = offer.segments[0];
  const last = offer.segments.at(-1)!;
  return {
    kind: "flight",
    title: `${first.from} → ${last.to}`,
    start: first.departAt,
    tz: getAirport(first.from)?.tz ?? "UTC",
    end: last.arriveAt,
    endTz: getAirport(last.to)?.tz ?? "UTC",
    segments: offer.segments,
    layovers: offer.layovers,
    cabin: offer.cabin,
    fareMode: opts.fareMode,
    fare: offer.fare,
    price: offer.price,
    currency: offer.currency,
    status: opts.status ?? (opts.fareMode === "id90" || opts.fareMode === "zed" ? "listed" : "planned"),
    source: opts.source,
    pricedFor: dateOf(first.departAt),
    reportedLoads: opts.reportedLoads,
    backups: opts.backups ?? [],
  };
}

function shiftItem(item: TripItem, days: number): TripItem {
  if (days === 0) return item;
  const shifted = {
    ...item,
    start: addDaysLocal(item.start, days),
    end: item.end ? addDaysLocal(item.end, days) : undefined,
  };
  if (item.kind !== "flight") return shifted as TripItem;
  return {
    ...(shifted as FlightItem),
    segments: item.segments.map((s) => ({
      ...s,
      departAt: addDaysLocal(s.departAt, days),
      arriveAt: addDaysLocal(s.arriveAt, days),
    })),
    // Backups were for the old date.
    backups: [],
  };
}

export type NewItem = TripItem extends infer T ? (T extends TripItem ? Omit<T, "id" | "order"> : never) : never;

interface PlannerState {
  trips: Trip[];
  activeTripId: string | null;

  createTrip: (name: string, home?: string) => string;
  renameTrip: (id: string, name: string) => void;
  setHome: (id: string, home: string | undefined) => void;
  deleteTrip: (id: string) => void;
  setActiveTrip: (id: string) => void;

  addItem: (tripId: string, item: NewItem) => string;
  updateItem: (tripId: string, itemId: string, patch: Partial<TripItem>) => void;
  removeItem: (tripId: string, itemId: string) => void;
  /** Move an item to another day, keeping its time of day. */
  moveToDay: (tripId: string, itemId: string, day: string) => void;
  /** Swap a flight with one of its backups. */
  promoteBackup: (tripId: string, itemId: string, backupIndex: number) => void;
}

const mapTrip = (trips: Trip[], id: string, fn: (t: Trip) => Trip) => trips.map((t) => (t.id === id ? fn(t) : t));

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      trips: [],
      activeTripId: null,

      createTrip: (name, home) => {
        const id = uid();
        set((s) => ({
          trips: [...s.trips, { id, name, home, createdAt: Date.now(), items: [] }],
          activeTripId: id,
        }));
        return id;
      },
      renameTrip: (id, name) => set((s) => ({ trips: mapTrip(s.trips, id, (t) => ({ ...t, name })) })),
      setHome: (id, home) => set((s) => ({ trips: mapTrip(s.trips, id, (t) => ({ ...t, home })) })),
      deleteTrip: (id) =>
        set((s) => {
          const trips = s.trips.filter((t) => t.id !== id);
          return { trips, activeTripId: s.activeTripId === id ? (trips[0]?.id ?? null) : s.activeTripId };
        }),
      setActiveTrip: (id) => set({ activeTripId: id }),

      addItem: (tripId, item) => {
        const id = uid();
        set((s) => ({
          trips: mapTrip(s.trips, tripId, (t) => ({
            ...t,
            items: [...t.items, { ...item, id, order: t.items.length } as TripItem],
          })),
        }));
        return id;
      },
      updateItem: (tripId, itemId, patch) =>
        set((s) => ({
          trips: mapTrip(s.trips, tripId, (t) => ({
            ...t,
            items: t.items.map((i) => (i.id === itemId ? ({ ...i, ...patch } as TripItem) : i)),
          })),
        })),
      removeItem: (tripId, itemId) =>
        set((s) => ({
          trips: mapTrip(s.trips, tripId, (t) => ({ ...t, items: t.items.filter((i) => i.id !== itemId) })),
        })),
      moveToDay: (tripId, itemId, day) =>
        set((s) => ({
          trips: mapTrip(s.trips, tripId, (t) => ({
            ...t,
            items: t.items.map((i) =>
              i.id === itemId ? { ...shiftItem(i, daysBetween(dateOf(i.start), day)), order: Date.now() } : i,
            ),
          })),
        })),
      promoteBackup: (tripId, itemId, backupIndex) =>
        set((s) => ({
          trips: mapTrip(s.trips, tripId, (t) => ({
            ...t,
            items: t.items.map((i) => {
              if (i.id !== itemId || i.kind !== "flight") return i;
              const chosen = i.backups[backupIndex];
              if (!chosen) return i;
              const previous: FlightOffer = {
                id: `${i.id}-prev`,
                segments: i.segments,
                layovers: i.layovers,
                totalDurationMinutes: i.segments.reduce((m, x) => m + x.durationMinutes, 0) +
                  i.layovers.reduce((m, l) => m + l.durationMinutes, 0),
                cabin: i.cabin,
                price: i.price,
                currency: i.currency,
                fare: i.fare,
              };
              const next = flightItemFromOffer(chosen, { fareMode: i.fareMode, source: i.source, status: i.status });
              return {
                ...i,
                ...next,
                id: i.id,
                order: i.order,
                notes: i.notes,
                reportedLoads: undefined,
                backups: [previous, ...i.backups.filter((_, k) => k !== backupIndex)],
              };
            }),
          })),
        })),
    }),
    {
      name: "skyplan:trips",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function useActiveTrip() {
  return usePlanner((s) => s.trips.find((t) => t.id === s.activeTripId) ?? s.trips[0] ?? null);
}

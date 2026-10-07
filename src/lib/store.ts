"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { StaffProfile } from "@/lib/staff-travel/engine";
import type { Cabin, FareMode } from "@/lib/types";

export type Projection = "globe" | "mercator";
export type Direction = "outbound" | "inbound";

function defaultTravelDate() {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 10);
}

interface SkyPlanState {
  /** Airport whose network is shown. */
  selected: string | null;
  /** Other end of the route open in the panel. */
  routeTo: string | null;
  direction: Direction;
  projection: Projection;
  fareMode: FareMode;
  cabin: Cabin;
  travelDate: string;
  staffProfile: StaffProfile;

  selectAirport: (iata: string | null) => void;
  openRoute: (iata: string | null) => void;
  setDirection: (d: Direction) => void;
  setProjection: (p: Projection) => void;
  setFareMode: (m: FareMode) => void;
  setCabin: (c: Cabin) => void;
  setTravelDate: (d: string) => void;
  setStaffProfile: (p: Partial<StaffProfile>) => void;
}

export const useSkyPlan = create<SkyPlanState>()(
  persist(
    (set) => ({
      selected: null,
      routeTo: null,
      direction: "outbound",
      projection: "globe",
      fareMode: "commercial",
      cabin: "economy",
      travelDate: defaultTravelDate(),
      staffProfile: { airline: "BA", yearsOfService: 6, relationship: "employee" },

      selectAirport: (iata) => set({ selected: iata, routeTo: null }),
      openRoute: (iata) => set({ routeTo: iata }),
      setDirection: (direction) => set({ direction }),
      setProjection: (projection) => set({ projection }),
      setFareMode: (fareMode) => set({ fareMode }),
      setCabin: (cabin) => set({ cabin }),
      setTravelDate: (travelDate) => set({ travelDate }),
      setStaffProfile: (p) => set((s) => ({ staffProfile: { ...s.staffProfile, ...p } })),
    }),
    {
      name: "skyplan:prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Selection and dates are per visit; preferences persist.
      partialize: (s) => ({
        projection: s.projection,
        fareMode: s.fareMode,
        cabin: s.cabin,
        staffProfile: s.staffProfile,
      }),
    },
  ),
);

/** The route open in the panel as [from, to], respecting direction. */
export function useOpenRoute(): [string, string] | null {
  const { selected, routeTo, direction } = useSkyPlan();
  if (!selected || !routeTo) return null;
  return direction === "outbound" ? [selected, routeTo] : [routeTo, selected];
}

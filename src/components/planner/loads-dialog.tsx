"use client";

import { useState } from "react";

import { OddsMeter, OddsText, ReportedLoadsFields } from "@/components/flights/standby-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlanner } from "@/lib/planner/store";
import type { FlightItem } from "@/lib/planner/types";
import { checkInAdvice, type ReportedLoads } from "@/lib/staff-travel/engine";
import { offerOdds } from "@/lib/staff-travel/offer-odds";
import { useSkyPlan } from "@/lib/store";
import type { FlightOffer } from "@/lib/types";

export function LoadsDialog({
  tripId,
  item,
  offer,
  onOpenChange,
}: {
  tripId: string;
  item: FlightItem;
  offer: FlightOffer;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useSkyPlan((s) => s.staffProfile);
  const updateItem = usePlanner((s) => s.updateItem);
  const [loads, setLoads] = useState<Record<string, ReportedLoads>>(item.reportedLoads ?? {});
  const odds = offerOdds(offer, { mode: item.fareMode, cabin: item.cabin, profile, reportedLoads: loads });
  const real = Object.keys(loads).length > 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Loads for {item.segments.map((s) => s.flightNumber).join(" / ")}</DialogTitle>
          <DialogDescription>
            Check your staff travel portal close to departure and update these; odds change fast in the last 24 hours.
          </DialogDescription>
        </DialogHeader>
        <ReportedLoadsFields offer={offer} value={loads} onChange={setLoads} />
        <div className="space-y-2 rounded-lg border p-3">
          <p className="flex items-baseline justify-between text-sm">
            <span>{real ? "Chance to clear, from your loads" : "Estimated chance to clear"}</span>
            <OddsText odds={odds} className="text-lg font-semibold" />
          </p>
          <OddsMeter odds={odds} />
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {checkInAdvice(odds, "standby").map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              updateItem(tripId, item.id, { reportedLoads: real ? loads : undefined });
              onOpenChange(false);
            }}
          >
            Save loads
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

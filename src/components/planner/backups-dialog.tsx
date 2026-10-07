"use client";

import { ArrowUpDown, Trash2 } from "lucide-react";

import { BackupList, offerKey, useBackups } from "@/components/flights/backup-list";
import { OddsText } from "@/components/flights/standby-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlanner } from "@/lib/planner/store";
import type { FlightItem } from "@/lib/planner/types";
import { offerOdds } from "@/lib/staff-travel/offer-odds";
import { useSkyPlan } from "@/lib/store";
import { dateOf } from "@/lib/time";
import type { FlightOffer } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

export function BackupsDialog({
  tripId,
  item,
  onOpenChange,
}: {
  tripId: string;
  item: FlightItem;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useSkyPlan((s) => s.staffProfile);
  const updateItem = usePlanner((s) => s.updateItem);
  const promote = usePlanner((s) => s.promoteBackup);
  const first = item.segments[0];
  const last = item.segments.at(-1)!;
  const query = useBackups({
    from: first.from,
    to: last.to,
    date: dateOf(first.departAt),
    cabin: item.cabin,
    mode: item.fareMode,
    exclude: item.segments.map((s) => s.flightNumber),
  });

  const toggle = (offer: FlightOffer) => {
    const exists = item.backups.some((b) => offerKey(b) === offerKey(offer));
    updateItem(tripId, item.id, {
      backups: exists ? item.backups.filter((b) => offerKey(b) !== offerKey(offer)) : [...item.backups, offer],
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Backups for {item.segments.map((s) => s.flightNumber).join(" / ")}
          </DialogTitle>
          <DialogDescription>
            Keep a plan B in case you don&apos;t clear. Switching makes a backup your main flight.
          </DialogDescription>
        </DialogHeader>

        {item.backups.length > 0 && (
          <section aria-labelledby="saved-h" className="space-y-2">
            <h3 id="saved-h" className="text-sm font-semibold">
              Saved
            </h3>
            <ul className="divide-y rounded-md border">
              {item.backups.map((b, i) => (
                <li key={offerKey(b)} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium tabular-nums">
                      {b.segments[0].departAt.slice(5, 10)} {b.segments[0].departAt.slice(11, 16)}–
                      {b.segments.at(-1)!.arriveAt.slice(11, 16)}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {b.segments.map((s) => s.flightNumber).join("/")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.layovers.length ? `via ${b.layovers.map((l) => l.airport).join(", ")}` : "Nonstop"} ·{" "}
                      {formatDuration(b.totalDurationMinutes)}
                    </p>
                  </div>
                  {(item.fareMode === "id90" || item.fareMode === "zed") && (
                    <OddsText
                      odds={offerOdds(b, { mode: item.fareMode, cabin: item.cabin, profile })}
                      className="font-semibold"
                    />
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => promote(tripId, item.id, i)}>
                    <ArrowUpDown /> Switch
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Remove backup"
                    onClick={() => toggle(b)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="more-h" className="space-y-2">
          <h3 id="more-h" className="text-sm font-semibold">
            Other flights that day and the next
          </h3>
          <BackupList query={query} selected={item.backups} onToggle={toggle} limit={6} />
        </section>
      </DialogContent>
    </Dialog>
  );
}

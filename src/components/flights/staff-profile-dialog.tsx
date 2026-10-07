"use client";

import { BadgeCheck, Pencil } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AIRLINES, getAirline } from "@/lib/data/network";
import type { Relationship } from "@/lib/staff-travel/engine";
import { useSkyPlan } from "@/lib/store";

const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "spouse", label: "Spouse or partner" },
  { value: "dependent", label: "Dependent child" },
  { value: "parent", label: "Parent" },
  { value: "companion", label: "Travel companion (buddy pass)" },
];

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Compact summary of the staff profile with an edit dialog. */
export function StaffProfileLine() {
  const profile = useSkyPlan((s) => s.staffProfile);
  const setProfile = useSkyPlan((s) => s.setStaffProfile);
  const ids = { airline: useId(), years: useId(), rel: useId() };
  const relLabel = RELATIONSHIPS.find((r) => r.value === profile.relationship)?.label ?? "";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
          <BadgeCheck className="text-signal" />
          {profile.airline} · {relLabel.split(" ")[0]} · {profile.yearsOfService} yrs
          <Pencil className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Staff travel profile</DialogTitle>
          <DialogDescription>
            Sets your standby priority. Own-airline travel ranks ahead of interline (ZED) travel.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor={ids.airline} className="text-sm font-medium">
              Employing airline
            </label>
            <select
              id={ids.airline}
              className={inputClass}
              value={profile.airline}
              onChange={(e) => setProfile({ airline: e.target.value })}
            >
              {AIRLINES.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Alliance: {getAirline(profile.airline)?.alliance ?? "none"}
            </p>
          </div>
          <div className="grid gap-2">
            <label htmlFor={ids.rel} className="text-sm font-medium">
              Traveller
            </label>
            <select
              id={ids.rel}
              className={inputClass}
              value={profile.relationship}
              onChange={(e) => setProfile({ relationship: e.target.value as Relationship })}
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor={ids.years} className="text-sm font-medium">
              Years of service
            </label>
            <input
              id={ids.years}
              type="number"
              min={0}
              max={60}
              className={`${inputClass} tabular-nums`}
              value={profile.yearsOfService}
              onChange={(e) =>
                setProfile({ yearsOfService: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })
              }
            />
            <p className="text-xs text-muted-foreground">Breaks ties within the same priority.</p>
          </div>
        </div>
        <DialogClose asChild>
          <Button className="w-full">Done</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

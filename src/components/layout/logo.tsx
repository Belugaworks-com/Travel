import { PlaneTakeoff } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-signal text-signal-foreground">
        <PlaneTakeoff className="size-4" strokeWidth={2.25} />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">SkyPlan</span>
    </div>
  );
}

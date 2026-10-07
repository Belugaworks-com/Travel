import { Database, Radio } from "lucide-react";

import type { DataSource } from "@/lib/types";

/** Says plainly whether numbers are live or modelled. */
export function SourceNote({ source, live, sample }: { source: DataSource; live: string; sample: string }) {
  const Icon = source === "live" ? Radio : Database;
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Icon className="size-3 shrink-0" />
      {source === "live" ? live : sample}
    </p>
  );
}

import { Badge } from "@/components/ui/badge";
import type { FareLevel } from "@/lib/types";

const LEVEL = {
  cheap: { label: "Cheap", variant: "good" },
  average: { label: "Average", variant: "secondary" },
  high: { label: "High", variant: "bad" },
} as const;

export function FareLevelBadge({ level }: { level: FareLevel }) {
  const { label, variant } = LEVEL[level];
  return <Badge variant={variant}>{label}</Badge>;
}

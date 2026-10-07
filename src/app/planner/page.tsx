import type { Metadata } from "next";

import { PlannerShell } from "@/components/planner/planner-shell";

export const metadata: Metadata = { title: "Planner · SkyPlan" };

export default function PlannerPage() {
  return <PlannerShell />;
}

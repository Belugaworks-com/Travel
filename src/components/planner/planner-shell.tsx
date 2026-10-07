"use client";

import dynamic from "next/dynamic";

import { AppHeaderSkeleton } from "@/components/layout/app-header-skeleton";

// Trips live in this browser's storage, so the planner renders client-side.
const PlannerApp = dynamic(() => import("./planner-app"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col">
      <AppHeaderSkeleton />
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  ),
});

export function PlannerShell() {
  return <PlannerApp />;
}

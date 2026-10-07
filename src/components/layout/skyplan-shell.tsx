"use client";

import dynamic from "next/dynamic";

import { AppHeaderSkeleton } from "./app-header-skeleton";

// The map and preferences live in the browser (WebGL, localStorage), so the
// app body renders client-side; the server sends a matching skeleton.
const SkyPlanApp = dynamic(() => import("./skyplan-app"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col">
      <AppHeaderSkeleton />
      <div className="flex-1 animate-pulse bg-muted/40" />
    </div>
  ),
});

export function SkyPlanShell() {
  return <SkyPlanApp />;
}

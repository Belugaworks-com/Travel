import type { NextRequest } from "next/server";

import { getRouteInfo } from "@/lib/api/route-info";
import { badRequest, routeInfoQuery } from "@/lib/api/schemas";

/**
 * GET /api/flights/route-info?from=LHR&to=JFK&date=2026-11-02
 * Operating carriers, aircraft and cabin configs, estimated loads and the
 * standby score. Carriers come from Aviationstack when AVIATIONSTACK_API_KEY
 * is set; loads are always modelled estimates.
 */
export async function GET(request: NextRequest) {
  const parsed = routeInfoQuery.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return badRequest(parsed.error);
  const { from, to, date } = parsed.data;
  const day = date ? new Date(`${date}T00:00:00Z`) : new Date();
  return Response.json(await getRouteInfo(from, to, day));
}

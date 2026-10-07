import type { NextRequest } from "next/server";
import { z } from "zod";

import { getDestinations } from "@/lib/api/destinations";
import { badRequest, cabin, iataCode } from "@/lib/api/schemas";

const query = z.object({
  origin: iataCode,
  direction: z.enum(["outbound", "inbound"]).default("outbound"),
  cabin: cabin.default("economy"),
  date: z.iso.date(),
});

/**
 * GET /api/flights/destinations?origin=LHR&date=2026-11-02&direction=outbound
 * Every nonstop and one-stop destination from (or to) an airport, with an
 * estimated cheapest fare and its level against the route's typical range.
 */
export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest(parsed.error);
  const { origin, direction, cabin: c, date } = parsed.data;
  return Response.json(getDestinations(origin, direction, c, new Date(`${date}T00:00:00Z`)));
}

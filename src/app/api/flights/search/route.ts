import type { NextRequest } from "next/server";

import { searchFlights } from "@/lib/api/flight-search";
import { badRequest, flightSearchQuery } from "@/lib/api/schemas";

/**
 * GET /api/flights/search?from=LHR&to=JFK&date=2026-11-02&cabin=economy
 * Optional filters: maxStops, maxLayoverMinutes, airline, maxPrice.
 *
 * Uses SerpApi's Google Flights engine when SERPAPI_API_KEY is set; otherwise
 * returns sample fares with `source: "sample"`.
 */
export async function GET(request: NextRequest) {
  const parsed = flightSearchQuery.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return badRequest(parsed.error);
  return Response.json(await searchFlights(parsed.data));
}

import type { NextRequest } from "next/server";
import { z } from "zod";

import { findBackups } from "@/lib/api/backups";
import { badRequest, cabin, fareMode, iataCode } from "@/lib/api/schemas";

const query = z
  .object({
    from: iataCode,
    to: iataCode,
    date: z.iso.date(),
    cabin: cabin.default("economy"),
    mode: fareMode.default("id90"),
    airline: z.string().regex(/^[A-Z0-9]{2}$/),
    years: z.coerce.number().min(0).max(60).default(0),
    relationship: z.enum(["employee", "spouse", "dependent", "parent", "companion"]).default("employee"),
    exclude: z.string().optional(),
  })
  .refine((q) => q.from !== q.to, { message: "Origin and destination must differ", path: ["to"] });

/**
 * GET /api/flights/backups?from=LHR&to=JFK&date=2026-11-20&mode=id90&airline=BA
 * Alternatives to a standby flight (same day and next day), ranked by the
 * chance of clearing. `exclude` is a comma-separated list of flight numbers.
 */
export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest(parsed.error);
  const q = parsed.data;
  return Response.json(
    await findBackups({
      from: q.from,
      to: q.to,
      date: q.date,
      cabin: q.cabin,
      mode: q.mode,
      profile: { airline: q.airline, yearsOfService: q.years, relationship: q.relationship },
      exclude: q.exclude ? q.exclude.split(",").map((s) => s.trim().toUpperCase()) : [],
    }),
  );
}

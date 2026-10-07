import { z } from "zod";

import { isKnownAirport } from "@/lib/data/airports";
import { CABINS } from "@/lib/types";

export const iataCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Expected a 3-letter IATA code")
  .refine(isKnownAirport, "Airport not in SkyPlan's network yet");

export const cabin = z.enum(CABINS);
export const fareMode = z.enum(["commercial", "id50", "id90", "zed"]);

export const flightSearchQuery = z
  .object({
    from: iataCode,
    to: iataCode,
    date: z.iso.date(),
    cabin: cabin.default("economy"),
    maxStops: z.coerce.number().int().min(0).max(2).optional(),
    maxLayoverMinutes: z.coerce.number().int().positive().optional(),
    airline: z
      .string()
      .regex(/^[A-Z0-9]{2}$/)
      .optional(),
    maxPrice: z.coerce.number().positive().optional(),
  })
  .refine((q) => q.from !== q.to, { message: "Origin and destination must differ", path: ["to"] });

export type FlightSearchQuery = z.infer<typeof flightSearchQuery>;

export const routeInfoQuery = z
  .object({ from: iataCode, to: iataCode, date: z.iso.date().optional() })
  .refine((q) => q.from !== q.to, { message: "Origin and destination must differ", path: ["to"] });

export const staffRateRequest = z.object({
  fare: z.object({
    baseFare: z.number().nonnegative(),
    governmentTaxes: z.number().nonnegative(),
    carrierSurcharge: z.number().nonnegative(),
    currency: z.string().length(3).default("USD"),
  }),
  distanceMiles: z.number().nonnegative(),
  cabin: cabin.default("economy"),
  modes: z.array(fareMode).min(1).default(["commercial", "id50", "id90", "zed"]),
  /** Optional: include standby priority and odds. */
  standby: z
    .object({
      profile: z.object({
        airline: z.string().regex(/^[A-Z0-9]{2}$/),
        yearsOfService: z.number().min(0).max(60),
        relationship: z.enum(["employee", "spouse", "dependent", "parent", "companion"]),
      }),
      operatingAirline: z.string().regex(/^[A-Z0-9]{2}$/),
      sameAlliance: z.boolean().default(false),
      aircraft: z.string().optional(),
      loadFactor: z.number().min(0).max(1.1),
      /** Loads from the airline's staff portal; when given, they replace the model. */
      reportedLoads: z
        .object({
          openSeats: z.number().int().min(-99).max(999),
          listedAhead: z.number().int().min(0).max(999),
        })
        .optional(),
    })
    .optional(),
});

export type StaffRateRequest = z.infer<typeof staffRateRequest>;

export function badRequest(error: z.ZodError) {
  return Response.json(
    {
      error: "Invalid request",
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
    { status: 400 },
  );
}

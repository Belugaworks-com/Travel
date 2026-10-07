import { badRequest, staffRateRequest } from "@/lib/api/schemas";
import { getAircraft } from "@/lib/data/aircraft";
import {
  calculateStaffFare,
  checkInAdvice,
  standbyOdds,
  standbyPriority,
} from "@/lib/staff-travel/engine";
import { CABINS, type Cabin } from "@/lib/types";

/**
 * POST /api/staff-rates/calculate
 * Body: { fare, distanceMiles, cabin, modes?, standby? }
 * Returns a breakdown per fare mode (commercial, ID50, ID90, ZED) and, when
 * `standby` is given, the traveller's priority, odds and check-in advice.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = staffRateRequest.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const { fare, distanceMiles, cabin, modes, standby } = parsed.data;

  const results = modes.map((mode) => {
    const breakdown = calculateStaffFare({ fare, mode, cabin, distanceMiles });
    if (!standby) return { ...breakdown };

    const priority = standbyPriority(
      standby.profile,
      mode,
      standby.operatingAirline,
      standby.sameAlliance,
    );
    const aircraft = standby.aircraft ? getAircraft(standby.aircraft) : undefined;
    const odds = aircraft
      ? standbyOdds({
          config: aircraft.config,
          loadFactor: Object.fromEntries(
            CABINS.map((c) => [c, standby.loadFactor]),
          ) as Record<Cabin, number>,
          tier: priority.tier,
        })[cabin]
      : null;
    return {
      ...breakdown,
      priority,
      odds: breakdown.boarding === "confirmed" ? 1 : odds,
      advice: checkInAdvice(odds ?? 0.5, breakdown.boarding),
    };
  });

  return Response.json({ cabin, distanceMiles, results });
}

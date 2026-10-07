import "server-only";

import { searchFlights } from "@/lib/api/flight-search";
import { routeDistance } from "@/lib/pricing/sample-fares";
import { calculateStaffFare, type StaffProfile } from "@/lib/staff-travel/engine";
import { offerOdds } from "@/lib/staff-travel/offer-odds";
import type { Cabin, DataSource, FareMode, FlightOffer } from "@/lib/types";

export interface BackupOption {
  offer: FlightOffer;
  /** Chance of clearing every leg; 1 for confirmed fares. */
  odds: number;
  /** All-in price under the chosen fare mode. */
  total: number;
  /** 0 = same day as the original, 1 = next day. */
  dayOffset: 0 | 1;
}

export interface BackupsResult {
  source: DataSource;
  options: BackupOption[];
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Alternatives to a standby flight: other departures that day and the next,
 * nonstop or connecting, ranked by the chance of getting on.
 */
export async function findBackups(params: {
  from: string;
  to: string;
  date: string;
  cabin: Cabin;
  mode: FareMode;
  profile: StaffProfile;
  exclude: string[];
  limit?: number;
}): Promise<BackupsResult> {
  const { from, to, date, cabin, mode, profile, exclude, limit = 8 } = params;
  const days = [date, addDays(date, 1)];
  const searches = await Promise.all(days.map((d) => searchFlights({ from, to, date: d, cabin })));
  const miles = routeDistance(from, to);
  const skip = new Set(exclude);

  const options: BackupOption[] = searches.flatMap((result, dayOffset) =>
    result.offers
      .filter((o) => !o.segments.every((s) => skip.has(s.flightNumber)))
      .map((offer) => ({
        offer,
        odds: offerOdds(offer, { mode, cabin, profile, typicalRange: result.insights?.typicalRange }),
        total: calculateStaffFare({ fare: offer.fare, mode, cabin, distanceMiles: miles }).total,
        dayOffset: dayOffset as 0 | 1,
      })),
  );

  options.sort(
    (a, b) =>
      // Prefer clearly better odds; within ~5 points, prefer the earlier arrival.
      (Math.abs(a.odds - b.odds) > 0.05 ? b.odds - a.odds : 0) ||
      a.offer.segments.at(-1)!.arriveAt.localeCompare(b.offer.segments.at(-1)!.arriveAt),
  );

  return {
    source: searches.some((s) => s.source === "live") ? "live" : "sample",
    options: options.slice(0, limit),
  };
}

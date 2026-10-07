import { getAircraft, matchAircraft } from "@/lib/data/aircraft";
import { getAirport } from "@/lib/data/airports";
import { getAirline } from "@/lib/data/network";
import { loadFactorFor } from "@/lib/loads";
import {
  adjustLoadForPrice,
  oddsFromReportedLoads,
  standbyOdds,
  standbyPriority,
  type ReportedLoads,
  type StaffProfile,
} from "@/lib/staff-travel/engine";
import type { Cabin, FareMode, FlightOffer, FlightSegment } from "@/lib/types";
import { CABINS } from "@/lib/types";

export interface OddsContext {
  mode: FareMode;
  cabin: Cabin;
  profile: StaffProfile;
  /** The route's typical price range, for the price signal. */
  typicalRange?: [number, number];
  /** Real loads per segment (by flight number) from a staff portal. */
  reportedLoads?: Record<string, ReportedLoads>;
}

export function sameAlliance(a: string, b: string) {
  const x = getAirline(a)?.alliance;
  return Boolean(x && x !== "none" && x === getAirline(b)?.alliance);
}

/** Aircraft for a segment, falling back to a typical type for the block time. */
function segmentConfig(seg: FlightSegment) {
  const match = matchAircraft(seg.aircraft);
  if (match) return match.aircraft.config;
  return getAircraft(seg.durationMinutes >= 300 ? "Airbus A330-300" : "Airbus A320")!.config;
}

export function segmentOdds(seg: FlightSegment, price: number, ctx: OddsContext): number {
  const tier = standbyPriority(ctx.profile, ctx.mode, seg.airline, sameAlliance(ctx.profile.airline, seg.airline)).tier;
  if (tier === 1) return 1;
  const reported = ctx.reportedLoads?.[seg.flightNumber];
  if (reported) return oddsFromReportedLoads(reported);

  const date = new Date(`${seg.departAt.slice(0, 10)}T00:00:00Z`);
  const known = getAirport(seg.from) && getAirport(seg.to);
  const loadFactor = Object.fromEntries(
    CABINS.map((c) => {
      const base = known ? loadFactorFor(seg.from, seg.to, seg.airline, date, c) : 0.84;
      return [c, ctx.typicalRange ? adjustLoadForPrice(base, price, ctx.typicalRange) : base];
    }),
  ) as Record<Cabin, number>;
  const odds = standbyOdds({ config: segmentConfig(seg), loadFactor, tier });
  return odds[ctx.cabin] ?? odds.economy ?? 0.5;
}

/** Chance of clearing every segment of an itinerary on standby (1 if confirmed). */
export function offerOdds(offer: FlightOffer, ctx: OddsContext) {
  return offer.segments.reduce((p, seg) => p * segmentOdds(seg, offer.price, ctx), 1);
}

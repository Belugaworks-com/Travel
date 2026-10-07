import type { RouteInfo, RouteOperator } from "@/lib/api/route-info";
import { getAirline } from "@/lib/data/network";
import { matchAircraft } from "@/lib/data/aircraft";
import { adjustLoadForPrice, standbyOdds } from "@/lib/staff-travel/engine";
import type { Cabin, FlightOffer, PriceInsights } from "@/lib/types";
import { CABINS } from "@/lib/types";

export interface EnrichedOperator extends RouteOperator {
  /** True when the aircraft came from live fare results. */
  liveAircraft: boolean;
  /** True when the cabin layout is the family's typical one, not an exact variant. */
  approximateLayout: boolean;
}

/**
 * Combine route info (carriers, modelled loads) with the live search results
 * for the same route and date: the aircraft each airline actually schedules,
 * and a price signal on how full each flight is. Airlines that only appear in
 * the fare results are added.
 */
export function enrichOperators(
  info: RouteInfo,
  offers: FlightOffer[] | undefined,
  insights: PriceInsights | null | undefined,
): EnrichedOperator[] {
  const nonstops = (offers ?? []).filter((o) => o.segments.length === 1);
  const cheapestByAirline = new Map<string, FlightOffer>();
  for (const o of nonstops) {
    const code = o.segments[0].airline;
    const prev = cheapestByAirline.get(code);
    if (!prev || o.price < prev.price) cheapestByAirline.set(code, o);
  }

  const base: RouteOperator[] = [...info.operators];
  for (const [code, offer] of cheapestByAirline) {
    if (base.some((op) => op.airline === code)) continue;
    const seg = offer.segments[0];
    const fallbackLoad = info.operators[0]?.loadFactor ?? Object.fromEntries(CABINS.map((c) => [c, 0.8]));
    base.push({
      airline: code,
      airlineName: getAirline(code)?.name ?? seg.airlineName,
      alliance: getAirline(code)?.alliance ?? "none",
      flightNumber: seg.flightNumber,
      aircraft: seg.aircraft,
      widebody: false,
      config: null,
      loadFactor: fallbackLoad as Record<Cabin, number>,
      standbyOdds: null,
    });
  }

  return base.map((op) => {
    const offer = cheapestByAirline.get(op.airline);
    const liveName = offer?.segments[0].aircraft;
    const match = matchAircraft(liveName) ?? matchAircraft(op.aircraft);
    const aircraft = liveName && liveName !== "Not published" ? liveName : op.aircraft;

    const loadFactor =
      offer && insights
        ? (Object.fromEntries(
            CABINS.map((c) => [c, adjustLoadForPrice(op.loadFactor[c], offer.price, insights.typicalRange)]),
          ) as Record<Cabin, number>)
        : op.loadFactor;

    const config = match?.aircraft.config ?? op.config;
    return {
      ...op,
      aircraft,
      widebody: match?.aircraft.widebody ?? op.widebody,
      config,
      loadFactor,
      standbyOdds: config ? standbyOdds({ config, loadFactor, tier: 2 }).economy : op.standbyOdds,
      liveAircraft: Boolean(offer && liveName && liveName !== "Not published"),
      approximateLayout: match ? !match.exact : false,
    };
  });
}

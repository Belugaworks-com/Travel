import type { Cabin, CabinConfig, FareMode, FareQuote } from "@/lib/types";

/**
 * Staff travel (non-rev) fare rules.
 *
 * - ID90 / ID50: an industry discount off the published base fare. Government
 *   taxes are never discounted; carrier surcharges are charged unless the
 *   airline's policy waives them.
 * - ZED: Zonal Employee Discount, a fixed fare per distance zone at three
 *   service levels (Low / Medium / High) for interline travel on partners.
 *
 * Every airline publishes its own variant, so the numbers live in
 * `StaffTravelRules` and can be swapped per employer.
 */

export interface ZedZone {
  zone: number;
  maxMiles: number;
  /** One-way fare in USD for each ZED service level. */
  low: number;
  medium: number;
  high: number;
}

export type ZedLevel = "low" | "medium" | "high";

export interface StaffTravelRules {
  id90Discount: number;
  id50Discount: number;
  waiveCarrierSurcharge: boolean;
  zedZones: ZedZone[];
  zedLevelByCabin: Record<Cabin, ZedLevel>;
}

/** Representative ZED table; replace with your airline's agreement figures. */
export const DEFAULT_ZED_ZONES: ZedZone[] = [
  { zone: 1, maxMiles: 450, low: 20, medium: 34, high: 50 },
  { zone: 2, maxMiles: 750, low: 25, medium: 43, high: 63 },
  { zone: 3, maxMiles: 1100, low: 31, medium: 52, high: 76 },
  { zone: 4, maxMiles: 1600, low: 38, medium: 64, high: 95 },
  { zone: 5, maxMiles: 2200, low: 47, medium: 80, high: 118 },
  { zone: 6, maxMiles: 2700, low: 55, medium: 94, high: 139 },
  { zone: 7, maxMiles: 3300, low: 64, medium: 109, high: 161 },
  { zone: 8, maxMiles: 4000, low: 73, medium: 124, high: 183 },
  { zone: 9, maxMiles: 4800, low: 81, medium: 138, high: 204 },
  { zone: 10, maxMiles: 5800, low: 92, medium: 157, high: 232 },
  { zone: 11, maxMiles: 7000, low: 105, medium: 178, high: 264 },
  { zone: 12, maxMiles: 8000, low: 118, medium: 200, high: 297 },
  { zone: 13, maxMiles: 9500, low: 129, medium: 220, high: 326 },
  { zone: 14, maxMiles: Infinity, low: 141, medium: 240, high: 355 },
];

export const DEFAULT_RULES: StaffTravelRules = {
  id90Discount: 0.9,
  id50Discount: 0.5,
  waiveCarrierSurcharge: false,
  zedZones: DEFAULT_ZED_ZONES,
  zedLevelByCabin: {
    economy: "low",
    premium_economy: "medium",
    business: "high",
    first: "high",
  },
};

export function zedZoneFor(miles: number, zones = DEFAULT_ZED_ZONES): ZedZone {
  if (!(miles >= 0)) throw new RangeError("Distance must be a non-negative number");
  return zones.find((z) => miles <= z.maxMiles) ?? zones[zones.length - 1];
}

export interface StaffFareInput {
  fare: FareQuote;
  mode: FareMode;
  cabin: Cabin;
  distanceMiles: number;
  rules?: StaffTravelRules;
}

export interface StaffFareBreakdown {
  mode: FareMode;
  currency: string;
  /** Published base fare the discount is applied to. */
  publishedBaseFare: number;
  discount: number;
  baseFare: number;
  governmentTaxes: number;
  carrierSurcharge: number;
  total: number;
  commercialTotal: number;
  savings: number;
  /** Firm (confirmed seat) or space-available standby. */
  boarding: "confirmed" | "standby";
  zed?: { zone: number; level: ZedLevel };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateStaffFare({
  fare,
  mode,
  cabin,
  distanceMiles,
  rules = DEFAULT_RULES,
}: StaffFareInput): StaffFareBreakdown {
  const commercialTotal = fare.baseFare + fare.governmentTaxes + fare.carrierSurcharge;
  const surcharge =
    mode !== "commercial" && rules.waiveCarrierSurcharge ? 0 : fare.carrierSurcharge;

  let baseFare = fare.baseFare;
  let discount = 0;
  let boarding: StaffFareBreakdown["boarding"] = "confirmed";
  let zed: StaffFareBreakdown["zed"];

  switch (mode) {
    case "commercial":
      break;
    case "id90":
      discount = fare.baseFare * rules.id90Discount;
      baseFare = fare.baseFare - discount;
      boarding = "standby";
      break;
    case "id50":
      discount = fare.baseFare * rules.id50Discount;
      baseFare = fare.baseFare - discount;
      break;
    case "zed": {
      const zone = zedZoneFor(distanceMiles, rules.zedZones);
      const level = rules.zedLevelByCabin[cabin];
      baseFare = zone[level];
      discount = Math.max(0, fare.baseFare - baseFare);
      boarding = "standby";
      zed = { zone: zone.zone, level };
      break;
    }
  }

  const total = baseFare + fare.governmentTaxes + surcharge;
  return {
    mode,
    currency: fare.currency,
    publishedBaseFare: round2(fare.baseFare),
    discount: round2(discount),
    baseFare: round2(baseFare),
    governmentTaxes: round2(fare.governmentTaxes),
    carrierSurcharge: round2(surcharge),
    total: round2(total),
    commercialTotal: round2(commercialTotal),
    savings: round2(commercialTotal - total),
    boarding,
    zed,
  };
}

// ---------------------------------------------------------------------------
// Standby priority and odds
// ---------------------------------------------------------------------------

export type Relationship = "employee" | "spouse" | "dependent" | "parent" | "companion";

export interface StaffProfile {
  /** IATA code of the employing airline. */
  airline: string;
  yearsOfService: number;
  relationship: Relationship;
}

export interface StandbyPriority {
  /** Lower boards first. 1 = confirmed, 2–5 own-airline standby, 6–7 interline. */
  tier: number;
  label: string;
  detail: string;
}

const RELATIONSHIP_TIER: Record<Relationship, number> = {
  employee: 2,
  spouse: 3,
  dependent: 3,
  parent: 4,
  companion: 5,
};

export function standbyPriority(
  profile: StaffProfile,
  mode: FareMode,
  operatingAirline: string,
  sameAlliance: boolean,
): StandbyPriority {
  if (mode === "commercial" || mode === "id50") {
    return { tier: 1, label: "Confirmed", detail: "Ticketed with a reserved seat; no standby list." };
  }
  const ownAirline = profile.airline === operatingAirline;
  if (ownAirline) {
    const tier = RELATIONSHIP_TIER[profile.relationship];
    return {
      tier,
      label: `Own-airline standby · P${tier}`,
      detail: `Ranked behind revenue and duty travel; ties broken by seniority (${profile.yearsOfService} yrs).`,
    };
  }
  const tier = sameAlliance ? 6 : 7;
  return {
    tier,
    label: `Interline standby · P${tier}`,
    detail: `${mode === "zed" ? "ZED" : "ID90"} on a partner carrier boards after the airline's own non-revs.`,
  };
}

export interface StandbyOddsInput {
  config: CabinConfig;
  loadFactor: Record<Cabin, number>;
  tier: number;
}

/**
 * Probability (0–1) of clearing standby in each cabin.
 *
 * Open seats = capacity × (1 − load factor) plus expected no-shows; the
 * listing queue ahead of you grows with priority tier. A logistic curve turns
 * the margin into a probability so the score degrades smoothly, capped to
 * 3–97% because the inputs are estimates.
 */
export function standbyOdds({ config, loadFactor, tier }: StandbyOddsInput) {
  const out = {} as Record<Cabin, number | null>;
  for (const cabin of ["economy", "premium_economy", "business", "first"] as Cabin[]) {
    const seats = config[cabin];
    if (seats === 0) {
      out[cabin] = null;
      continue;
    }
    const lf = loadFactor[cabin];
    const booked = seats * lf;
    const noShows = booked * 0.05;
    const open = seats - booked + noShows;
    const queueAhead = (tier - 1) * Math.max(0.6, seats / 120);
    const margin = open - queueAhead;
    const scale = Math.max(1.2, seats / 40);
    // A load estimate can't promise a seat (or rule one out), so cap the odds.
    out[cabin] = Math.min(0.97, Math.max(0.03, 1 / (1 + Math.exp(-margin / scale))));
  }
  return out;
}

export type OddsBand = "good" | "fair" | "poor";

export function oddsBand(p: number): OddsBand {
  if (p >= 0.7) return "good";
  if (p >= 0.4) return "fair";
  return "poor";
}

export function checkInAdvice(p: number, boarding: StaffFareBreakdown["boarding"]) {
  if (boarding === "confirmed") {
    return ["Seat is confirmed: check in online as normal."];
  }
  const advice = ["List for the flight as early as your airline allows."];
  if (p >= 0.7) {
    advice.push("Check in when online check-in opens; arrive at the gate 45 minutes before departure.");
  } else if (p >= 0.4) {
    advice.push("Check in the moment check-in opens and be at the gate 60 minutes out.");
    advice.push("List on the next departure too, in case this one closes out.");
  } else {
    advice.push("Loads are tight: plan a backup flight or route before you travel.");
    advice.push("Travel light; carry-on only makes a late seat assignment easier.");
  }
  return advice;
}

export interface ReportedLoads {
  /** Seats your staff portal shows as open in the cabin (negative if oversold). */
  openSeats: number;
  /** Non-revs listed ahead of you (higher priority or earlier check-in). */
  listedAhead: number;
}

/**
 * Odds from the loads an airline's staff portal shows. Much better than the
 * model: the only uncertainty left is late no-shows, go-shows and
 * reaccommodated passengers, so the curve is steep around a zero margin.
 */
export function oddsFromReportedLoads({ openSeats, listedAhead }: ReportedLoads) {
  const margin = openSeats - listedAhead;
  // At margin 0 you clear only if someone no-shows: roughly a coin flip on a busy flight.
  const p = 1 / (1 + Math.exp(-(margin + 0.3) / 1.6));
  return Math.min(0.97, Math.max(0.03, p));
}

/**
 * Nudge a modelled load factor using the fare: when a flight prices near the
 * top of its usual range, revenue management sees it filling up.
 */
export function adjustLoadForPrice(loadFactor: number, price: number, typicalRange: [number, number]) {
  const [lo, hi] = typicalRange;
  if (!(hi > lo)) return loadFactor;
  const position = Math.min(2, Math.max(-1, (price - lo) / (hi - lo)));
  const adjust = Math.min(0.06, Math.max(-0.06, (position - 0.5) * 0.08));
  return Math.min(1.04, Math.max(0.35, loadFactor + adjust));
}

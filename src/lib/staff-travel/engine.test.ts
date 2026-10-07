import { describe, expect, it } from "vitest";

import { getAircraft } from "@/lib/data/aircraft";
import type { Cabin, FareQuote } from "@/lib/types";

import {
  DEFAULT_RULES,
  calculateStaffFare,
  oddsBand,
  standbyOdds,
  standbyPriority,
  zedZoneFor,
} from "./engine";

const fare: FareQuote = {
  baseFare: 800,
  governmentTaxes: 180,
  carrierSurcharge: 220,
  currency: "USD",
};

const flat = (lf: number) =>
  ({ economy: lf, premium_economy: lf, business: lf, first: lf }) as Record<Cabin, number>;

describe("calculateStaffFare", () => {
  it("charges the full fare for commercial tickets", () => {
    const r = calculateStaffFare({ fare, mode: "commercial", cabin: "economy", distanceMiles: 3451 });
    expect(r.total).toBe(1200);
    expect(r.savings).toBe(0);
    expect(r.boarding).toBe("confirmed");
  });

  it("discounts only the base fare for ID90, keeping taxes and surcharge", () => {
    const r = calculateStaffFare({ fare, mode: "id90", cabin: "economy", distanceMiles: 3451 });
    expect(r.baseFare).toBe(80);
    expect(r.discount).toBe(720);
    expect(r.governmentTaxes).toBe(180);
    expect(r.carrierSurcharge).toBe(220);
    expect(r.total).toBe(480);
    expect(r.boarding).toBe("standby");
  });

  it("halves the base fare for ID50 and confirms the seat", () => {
    const r = calculateStaffFare({ fare, mode: "id50", cabin: "economy", distanceMiles: 3451 });
    expect(r.baseFare).toBe(400);
    expect(r.total).toBe(800);
    expect(r.boarding).toBe("confirmed");
  });

  it("waives the carrier surcharge on staff fares when the rules say so", () => {
    const rules = { ...DEFAULT_RULES, waiveCarrierSurcharge: true };
    const staff = calculateStaffFare({ fare, mode: "id90", cabin: "economy", distanceMiles: 3451, rules });
    const commercial = calculateStaffFare({ fare, mode: "commercial", cabin: "economy", distanceMiles: 3451, rules });
    expect(staff.carrierSurcharge).toBe(0);
    expect(commercial.carrierSurcharge).toBe(220);
  });

  it("prices ZED from the distance zone and cabin level", () => {
    const r = calculateStaffFare({ fare, mode: "zed", cabin: "business", distanceMiles: 3451 });
    expect(r.zed).toEqual({ zone: 8, level: "high" });
    expect(r.baseFare).toBe(183);
    expect(r.total).toBe(183 + 180 + 220);
  });
});

describe("zedZoneFor", () => {
  it("uses inclusive upper bounds", () => {
    expect(zedZoneFor(0).zone).toBe(1);
    expect(zedZoneFor(450).zone).toBe(1);
    expect(zedZoneFor(451).zone).toBe(2);
  });

  it("caps very long sectors at the last zone", () => {
    expect(zedZoneFor(10_500).zone).toBe(14);
  });

  it("rejects invalid distances", () => {
    expect(() => zedZoneFor(-1)).toThrow(RangeError);
    expect(() => zedZoneFor(Number.NaN)).toThrow(RangeError);
  });
});

describe("standbyPriority", () => {
  const profile = { airline: "BA", yearsOfService: 11, relationship: "employee" as const };

  it("treats confirmed fares as tier 1", () => {
    expect(standbyPriority(profile, "id50", "BA", true).tier).toBe(1);
  });

  it("ranks own-airline staff ahead of interline travel", () => {
    const own = standbyPriority(profile, "id90", "BA", true);
    const partner = standbyPriority(profile, "zed", "AA", true);
    const other = standbyPriority(profile, "zed", "DL", false);
    expect(own.tier).toBeLessThan(partner.tier);
    expect(partner.tier).toBeLessThan(other.tier);
  });
});

describe("standbyOdds", () => {
  const config = getAircraft("Boeing 777-300ER")!.config;

  it("falls as the flight fills up", () => {
    const light = standbyOdds({ config, loadFactor: flat(0.7), tier: 2 }).economy!;
    const full = standbyOdds({ config, loadFactor: flat(0.99), tier: 2 }).economy!;
    expect(light).toBeGreaterThan(0.9);
    expect(full).toBeLessThan(light);
  });

  it("falls with a lower priority tier", () => {
    const high = standbyOdds({ config, loadFactor: flat(0.95), tier: 2 }).economy!;
    const low = standbyOdds({ config, loadFactor: flat(0.95), tier: 7 }).economy!;
    expect(low).toBeLessThan(high);
  });

  it("returns null for cabins the aircraft doesn't have", () => {
    const narrow = getAircraft("Airbus A320neo")!.config;
    expect(standbyOdds({ config: narrow, loadFactor: flat(0.8), tier: 2 }).first).toBeNull();
  });

  it("bands odds into good / fair / poor", () => {
    expect(oddsBand(0.85)).toBe("good");
    expect(oddsBand(0.5)).toBe("fair");
    expect(oddsBand(0.2)).toBe("poor");
  });
});

import { describe, expect, it } from "vitest";

import { quoteTotal, splitFare } from "./sample-fares";

const date = new Date("2026-11-20T00:00:00Z");

describe("splitFare", () => {
  it("keeps the total intact", () => {
    const fare = splitFare(612, [{ from: "LHR", to: "JFK", airline: "BA" }], "economy", date);
    expect(quoteTotal(fare)).toBe(612);
    expect(fare.governmentTaxes).toBeGreaterThan(0);
  });

  it("still estimates taxes when a connection is outside the airport list", () => {
    const fare = splitFare(
      408,
      [
        { from: "LHR", to: "BRU", airline: "SN" },
        { from: "BRU", to: "JFK", airline: "SN" },
      ],
      "economy",
      date,
    );
    expect(fare.governmentTaxes).toBeGreaterThan(0);
    expect(fare.baseFare).toBeLessThan(408);
    expect(quoteTotal(fare)).toBe(408);
  });

  it("never estimates taxes above the price", () => {
    const fare = splitFare(60, [{ from: "LHR", to: "JFK", airline: "BA" }], "economy", date);
    expect(fare.baseFare).toBeGreaterThanOrEqual(0);
    expect(quoteTotal(fare)).toBe(60);
  });
});

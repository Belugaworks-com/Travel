import { describe, expect, it } from "vitest";

import { getAircraft } from "./aircraft";
import { AIRPORTS, getAirport } from "./airports";
import {
  getConnectingDestinations,
  getConnectingHubs,
  getDirectDestinations,
  getOperations,
  hasDirect,
} from "./network";

describe("route network", () => {
  it("only references known airports and aircraft", () => {
    for (const airport of AIRPORTS) {
      for (const dest of getDirectDestinations(airport.iata)) {
        expect(getAirport(dest), `${airport.iata}->${dest}`).toBeDefined();
        for (const op of getOperations(airport.iata, dest)) {
          expect(getAircraft(op.aircraft), op.aircraft).toBeDefined();
        }
      }
    }
  });

  it("is symmetric", () => {
    expect(hasDirect("LHR", "JFK")).toBe(true);
    expect(hasDirect("JFK", "LHR")).toBe(true);
    expect(getOperations("JFK", "LHR")).toEqual(getOperations("LHR", "JFK"));
  });

  it("finds one-stop hubs when there is no nonstop", () => {
    expect(hasDirect("LIS", "SYD")).toBe(false);
    const hubs = getConnectingHubs("LIS", "SYD");
    expect(hubs.length).toBeGreaterThan(0);
    for (const hub of hubs) {
      expect(hasDirect("LIS", hub) && hasDirect(hub, "SYD")).toBe(true);
    }
    expect(getConnectingDestinations("LIS")).toContain("SYD");
  });
});

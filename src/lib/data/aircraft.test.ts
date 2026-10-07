import { describe, expect, it } from "vitest";

import { matchAircraft } from "./aircraft";

describe("matchAircraft", () => {
  it.each([
    ["Boeing 777-300ER", "Boeing 777-300ER", true],
    ["Airbus A220-300 Passenger", "Airbus A220-300", true],
    ["Boeing 737MAX 8 Passenger", "Boeing 737 MAX 8", false],
    ["Boeing 737MAX 9 Passenger", "Boeing 737 MAX 9", false],
    ["Boeing 777", "Boeing 777-300ER", false],
    ["Airbus A330", "Airbus A330-300", false],
    ["Airbus A350", "Airbus A350-900", false],
    ["Airbus A321neo", "Airbus A321neo", true],
    ["Boeing 787", "Boeing 787-9", false],
  ])("%s -> %s", (input, expected, exact) => {
    const m = matchAircraft(input);
    expect(m?.aircraft.name).toBe(expected);
    expect(m?.exact).toBe(exact);
  });

  it("returns null for unknown types", () => {
    expect(matchAircraft("De Havilland Dash 8")).toBeNull();
    expect(matchAircraft(undefined)).toBeNull();
  });
});

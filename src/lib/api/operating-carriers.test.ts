import { describe, expect, it } from "vitest";

import { operatingCarriers, type AviationstackFlight } from "./operating-carriers";

const NAMES: Record<string, string> = { BA: "British Airways", SQ: "Singapore Airlines", VS: "Virgin Atlantic" };

const row = (
  scheduled: string,
  airline: string,
  flight: string,
  codeshared?: { airline_iata: string; airline_name: string; flight_iata: string },
): AviationstackFlight => ({
  departure: { scheduled },
  airline: { iata: airline, name: NAMES[airline] ?? airline },
  flight: { iata: flight, codeshared: codeshared ?? null },
});

describe("operatingCarriers", () => {
  it("credits codeshares to the operating airline", () => {
    const result = operatingCarriers([
      row("08:20", "AA", "AA6930", { airline_iata: "ba", airline_name: "british airways", flight_iata: "ba117" }),
      row("08:20", "IB", "IB3545", { airline_iata: "ba", airline_name: "british airways", flight_iata: "ba117" }),
      row("08:20", "BA", "BA117"),
    ]);
    expect(result).toEqual([{ airline: "BA", airlineName: "British Airways", flightNumber: "BA117", flights: 1 }]);
  });

  it("drops codeshare rows that are missing their codeshare link", () => {
    const result = operatingCarriers([
      row("09:00", "SQ", "SQ211"),
      row("09:00", "LH", "LH9765", { airline_iata: "sq", airline_name: "singapore airlines", flight_iata: "sq211" }),
      // Same slot, no link, not the operated flight: really a codeshare.
      row("09:00", "EK", "EK9618"),
    ]);
    expect(result.map((c) => c.airline)).toEqual(["SQ"]);
  });

  it("keeps independent flights and counts departures per airline", () => {
    const result = operatingCarriers([
      row("08:00", "BA", "BA183"),
      row("10:00", "BA", "BA175"),
      row("11:00", "VS", "VS25"),
      row("11:00", "DL", "DL5993", { airline_iata: "vs", airline_name: "virgin atlantic", flight_iata: "vs25" }),
    ]);
    expect(result).toEqual([
      { airline: "BA", airlineName: "British Airways", flightNumber: "BA183", flights: 2 },
      { airline: "VS", airlineName: "Virgin Atlantic", flightNumber: "VS25", flights: 1 },
    ]);
  });
});

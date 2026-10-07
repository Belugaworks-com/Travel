import type { Aircraft, CabinConfig } from "@/lib/types";

/**
 * Typical cabin configurations. Real seat counts vary by airline and by
 * sub-fleet; these are representative values used until a live seat-map
 * source is connected.
 */
function wide(
  name: string,
  f: number,
  j: number,
  w: number,
  y: number,
  yLayout: string,
  jLayout = "1-2-1",
): Aircraft {
  const layout: CabinConfig["layout"] = { business: jLayout, economy: yLayout };
  if (f > 0) layout.first = "1-1-1";
  if (w > 0) layout.premium_economy = yLayout === "3-4-3" ? "2-4-2" : "2-3-2";
  return {
    code: name,
    name,
    widebody: true,
    config: { first: f, business: j, premium_economy: w, economy: y, layout },
  };
}

function narrow(name: string, j: number, y: number, yLayout = "3-3"): Aircraft {
  return {
    code: name,
    name,
    widebody: false,
    config: {
      first: 0,
      business: j,
      premium_economy: 0,
      economy: y,
      layout: { business: yLayout === "3-3" ? "2-2" : "1-2", economy: yLayout },
    },
  };
}

const LIST: Aircraft[] = [
  wide("Airbus A380-800", 14, 76, 44, 335, "3-4-3"),
  wide("Airbus A350-1000", 0, 44, 40, 244, "3-3-3"),
  wide("Airbus A350-900", 0, 42, 24, 187, "3-3-3"),
  wide("Airbus A350-900ULR", 0, 67, 94, 0, "2-3-2"),
  wide("Airbus A340-300", 0, 30, 28, 221, "2-4-2"),
  wide("Airbus A330-900", 0, 29, 28, 224, "2-4-2"),
  wide("Airbus A330-300", 0, 36, 21, 235, "2-4-2"),
  wide("Airbus A330-200", 0, 24, 0, 264, "2-4-2"),
  wide("Boeing 747-8", 8, 80, 32, 244, "3-4-3"),
  wide("Boeing 777-300ER", 8, 42, 24, 280, "3-4-3"),
  wide("Boeing 777-200LR", 0, 38, 24, 204, "3-4-3"),
  wide("Boeing 777-200ER", 0, 48, 24, 200, "3-4-3"),
  wide("Boeing 777-200", 0, 50, 24, 290, "3-4-3"),
  wide("Boeing 787-10", 0, 44, 21, 253, "3-3-3"),
  wide("Boeing 787-9", 0, 42, 21, 183, "3-3-3"),
  wide("Boeing 787-8", 0, 30, 21, 183, "3-3-3"),
  wide("Boeing 767-400ER", 0, 34, 24, 187, "2-3-2"),
  wide("Boeing 767-300ER", 0, 30, 24, 157, "2-3-2", "1-1-1"),
  narrow("Airbus A321XLR", 16, 166),
  narrow("Airbus A321T", 30, 72),
  narrow("Airbus A321neo", 20, 176),
  narrow("Airbus A321", 20, 170),
  narrow("Airbus A320neo", 20, 160),
  narrow("Airbus A320", 20, 150),
  narrow("Airbus A220-300", 20, 128, "2-3"),
  narrow("Boeing 757-200", 16, 160),
  narrow("Boeing 737-900ER", 20, 159),
  narrow("Boeing 737-800", 16, 150),
  narrow("Boeing 737 MAX 9", 20, 159),
  narrow("Boeing 737 MAX 8", 16, 156),
  narrow("Embraer E195-E2", 20, 112, "2-2"),
  narrow("Embraer E175", 12, 64, "2-2"),
];

const byName = new Map(LIST.map((a) => [a.name, a]));

export function getAircraft(name: string): Aircraft | undefined {
  return byName.get(name);
}

export function totalSeats(config: CabinConfig) {
  return (
    config.first + config.business + config.premium_economy + config.economy
  );
}

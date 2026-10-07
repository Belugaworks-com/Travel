import { calculateStaffFare } from "@/lib/staff-travel/engine";
import type { Cabin, FareMode, FareQuote } from "@/lib/types";

/** All-in price for a fare under the chosen fare mode. */
export function priceIn(mode: FareMode, fare: FareQuote, cabin: Cabin, distanceMiles: number) {
  return calculateStaffFare({ fare, mode, cabin, distanceMiles }).total;
}

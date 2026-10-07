export type Cabin = "economy" | "premium_economy" | "business" | "first";

export const CABINS: Cabin[] = [
  "economy",
  "premium_economy",
  "business",
  "first",
];

export const CABIN_LABEL: Record<Cabin, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
};

/** How the traveller pays: full commercial fare or a staff travel product. */
export type FareMode = "commercial" | "id50" | "id90" | "zed";

export const FARE_MODE_LABEL: Record<FareMode, string> = {
  commercial: "Commercial",
  id50: "ID50",
  id90: "ID90",
  zed: "ZED",
};

export type FareLevel = "cheap" | "average" | "high";

/** Where a piece of data came from, so the UI never passes sample data off as live. */
export type DataSource = "live" | "sample";

export type Alliance = "oneworld" | "star" | "skyteam" | "none";

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface Airline {
  code: string;
  name: string;
  alliance: Alliance;
}

export interface CabinConfig {
  first: number;
  business: number;
  premium_economy: number;
  economy: number;
  /** Seat layout per cabin, e.g. "3-3-3". */
  layout: Partial<Record<Cabin, string>>;
}

export interface Aircraft {
  code: string;
  name: string;
  widebody: boolean;
  config: CabinConfig;
}

export interface FareQuote {
  baseFare: number;
  /** Government taxes and airport fees: always payable. */
  governmentTaxes: number;
  /** Carrier-imposed surcharge (YQ/YR). */
  carrierSurcharge: number;
  currency: string;
}

export interface FlightSegment {
  from: string;
  to: string;
  airline: string;
  airlineName: string;
  flightNumber: string;
  aircraft: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
}

export interface Layover {
  airport: string;
  durationMinutes: number;
}

export interface FlightOffer {
  id: string;
  segments: FlightSegment[];
  layovers: Layover[];
  totalDurationMinutes: number;
  cabin: Cabin;
  price: number;
  currency: string;
  /** Price split into base fare, taxes and surcharge (estimated for live results). */
  fare: FareQuote;
  /** SerpApi booking token, used to fetch booking options. */
  bookingToken?: string;
}

export interface PriceInsights {
  lowestPrice: number;
  typicalRange: [number, number];
  level: FareLevel;
  /** [unix seconds, price] pairs, oldest first. */
  history: [number, number][];
}

export interface FlightSearchResult {
  source: DataSource;
  offers: FlightOffer[];
  insights: PriceInsights | null;
}

import type { Airport } from "@/lib/types";

export const AIRPORTS: Airport[] = [
  { iata: "LHR", name: "Heathrow", city: "London", country: "United Kingdom", lat: 51.47, lon: -0.4543, tz: "Europe/London" },
  { iata: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France", lat: 49.0097, lon: 2.5479, tz: "Europe/Paris" },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Germany", lat: 50.0379, lon: 8.5622, tz: "Europe/Berlin" },
  { iata: "MUC", name: "Munich", city: "Munich", country: "Germany", lat: 48.3538, lon: 11.7861, tz: "Europe/Berlin" },
  { iata: "AMS", name: "Schiphol", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lon: 4.7683, tz: "Europe/Amsterdam" },
  { iata: "MAD", name: "Barajas", city: "Madrid", country: "Spain", lat: 40.4983, lon: -3.5676, tz: "Europe/Madrid" },
  { iata: "BCN", name: "El Prat", city: "Barcelona", country: "Spain", lat: 41.2974, lon: 2.0833, tz: "Europe/Madrid" },
  { iata: "LIS", name: "Humberto Delgado", city: "Lisbon", country: "Portugal", lat: 38.7742, lon: -9.1342, tz: "Europe/Lisbon" },
  { iata: "FCO", name: "Fiumicino", city: "Rome", country: "Italy", lat: 41.8003, lon: 12.2389, tz: "Europe/Rome" },
  { iata: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland", lat: 47.4582, lon: 8.5555, tz: "Europe/Zurich" },
  { iata: "DUB", name: "Dublin", city: "Dublin", country: "Ireland", lat: 53.4264, lon: -6.2499, tz: "Europe/Dublin" },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "Türkiye", lat: 41.2753, lon: 28.7519, tz: "Europe/Istanbul" },
  { iata: "DXB", name: "Dubai International", city: "Dubai", country: "United Arab Emirates", lat: 25.2532, lon: 55.3657, tz: "Asia/Dubai" },
  { iata: "DOH", name: "Hamad", city: "Doha", country: "Qatar", lat: 25.2731, lon: 51.6081, tz: "Asia/Qatar" },
  { iata: "DEL", name: "Indira Gandhi", city: "Delhi", country: "India", lat: 28.5562, lon: 77.1, tz: "Asia/Kolkata" },
  { iata: "JNB", name: "O. R. Tambo", city: "Johannesburg", country: "South Africa", lat: -26.1367, lon: 28.2411, tz: "Africa/Johannesburg" },
  { iata: "CPT", name: "Cape Town", city: "Cape Town", country: "South Africa", lat: -33.9715, lon: 18.6021, tz: "Africa/Johannesburg" },
  { iata: "SIN", name: "Changi", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915, tz: "Asia/Singapore" },
  { iata: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "Thailand", lat: 13.69, lon: 100.7501, tz: "Asia/Bangkok" },
  { iata: "HKG", name: "Hong Kong", city: "Hong Kong", country: "Hong Kong", lat: 22.308, lon: 113.9185, tz: "Asia/Hong_Kong" },
  { iata: "HND", name: "Haneda", city: "Tokyo", country: "Japan", lat: 35.5494, lon: 139.7798, tz: "Asia/Tokyo" },
  { iata: "ICN", name: "Incheon", city: "Seoul", country: "South Korea", lat: 37.4602, lon: 126.4407, tz: "Asia/Seoul" },
  { iata: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australia", lat: -33.9399, lon: 151.1753, tz: "Australia/Sydney" },
  { iata: "AKL", name: "Auckland", city: "Auckland", country: "New Zealand", lat: -37.0082, lon: 174.785, tz: "Pacific/Auckland" },
  { iata: "HNL", name: "Daniel K. Inouye", city: "Honolulu", country: "United States", lat: 21.3245, lon: -157.9251, tz: "Pacific/Honolulu" },
  { iata: "JFK", name: "John F. Kennedy", city: "New York", country: "United States", lat: 40.6413, lon: -73.7781, tz: "America/New_York" },
  { iata: "BOS", name: "Logan", city: "Boston", country: "United States", lat: 42.3656, lon: -71.0096, tz: "America/New_York" },
  { iata: "ORD", name: "O'Hare", city: "Chicago", country: "United States", lat: 41.9742, lon: -87.9073, tz: "America/Chicago" },
  { iata: "ATL", name: "Hartsfield-Jackson", city: "Atlanta", country: "United States", lat: 33.6407, lon: -84.4277, tz: "America/New_York" },
  { iata: "MIA", name: "Miami", city: "Miami", country: "United States", lat: 25.7959, lon: -80.287, tz: "America/New_York" },
  { iata: "DFW", name: "Dallas/Fort Worth", city: "Dallas", country: "United States", lat: 32.8998, lon: -97.0403, tz: "America/Chicago" },
  { iata: "LAX", name: "Los Angeles", city: "Los Angeles", country: "United States", lat: 33.9416, lon: -118.4085, tz: "America/Los_Angeles" },
  { iata: "SFO", name: "San Francisco", city: "San Francisco", country: "United States", lat: 37.6213, lon: -122.379, tz: "America/Los_Angeles" },
  { iata: "SEA", name: "Seattle-Tacoma", city: "Seattle", country: "United States", lat: 47.4502, lon: -122.3088, tz: "America/Los_Angeles" },
  { iata: "YYZ", name: "Pearson", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248, tz: "America/Toronto" },
  { iata: "MEX", name: "Benito Juárez", city: "Mexico City", country: "Mexico", lat: 19.4361, lon: -99.0719, tz: "America/Mexico_City" },
  { iata: "GRU", name: "Guarulhos", city: "São Paulo", country: "Brazil", lat: -23.4356, lon: -46.4731, tz: "America/Sao_Paulo" },
];

const byIata = new Map(AIRPORTS.map((a) => [a.iata, a]));

export function getAirport(iata: string): Airport | undefined {
  return byIata.get(iata.toUpperCase());
}

export function isKnownAirport(iata: string) {
  return byIata.has(iata.toUpperCase());
}

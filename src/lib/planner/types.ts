import type { ReportedLoads } from "@/lib/staff-travel/engine";
import type {
  Cabin,
  DataSource,
  FareMode,
  FareQuote,
  FlightOffer,
  FlightSegment,
  Layover,
} from "@/lib/types";

export type ItemKind = "flight" | "stay" | "activity" | "transfer" | "note";

export type FlightStatus =
  | "planned"
  | "listed"
  | "confirmed"
  | "checked_in"
  | "boarded"
  | "denied"
  | "cancelled";

export const FLIGHT_STATUS_LABEL: Record<FlightStatus, string> = {
  planned: "Planned",
  listed: "Listed",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  boarded: "Boarded",
  denied: "Not cleared",
  cancelled: "Cancelled",
};

interface BaseItem {
  id: string;
  kind: ItemKind;
  title: string;
  notes?: string;
  /** Local wall time "YYYY-MM-DDTHH:mm" in `tz`. */
  start: string;
  tz: string;
  end?: string;
  endTz?: string;
  /** No specific time: shown at the top of its day, ordered by `order`. */
  allDay?: boolean;
  order: number;
}

export interface FlightItem extends BaseItem {
  kind: "flight";
  segments: FlightSegment[];
  layovers: Layover[];
  cabin: Cabin;
  fareMode: FareMode;
  fare: FareQuote;
  price: number;
  currency: string;
  status: FlightStatus;
  source: DataSource;
  /** Date the price was fetched for; stale once the flight is moved. */
  pricedFor: string;
  /** Staff-portal loads per flight number. */
  reportedLoads?: Record<string, ReportedLoads>;
  /** Alternatives if this standby flight doesn't work out. */
  backups: FlightOffer[];
}

export interface StayItem extends BaseItem {
  kind: "stay";
  place: string;
  address?: string;
}

export interface ActivityItem extends BaseItem {
  kind: "activity" | "transfer";
  place?: string;
}

export interface NoteItem extends BaseItem {
  kind: "note";
}

export type TripItem = FlightItem | StayItem | ActivityItem | NoteItem;

export interface Trip {
  id: string;
  name: string;
  /** Home airport, so nights at home aren't flagged as missing a stay. */
  home?: string;
  createdAt: number;
  items: TripItem[];
}

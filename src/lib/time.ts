import { TZDate } from "@date-fns/tz";

/**
 * Times in SkyPlan are local wall-clock strings ("2026-11-20T07:40") paired
 * with an IANA zone, the way airlines print them. These helpers convert to
 * and from absolute instants.
 */

const pad = (n: number) => String(n).padStart(2, "0");

function parts(local: string) {
  const [d, t = "00:00"] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return { y, m, day, h, mi };
}

/** Local wall time in `tz` -> epoch ms. */
export function localToInstant(local: string, tz: string) {
  const { y, m, day, h, mi } = parts(local);
  return TZDate.tz(tz, y, m - 1, day, h, mi).getTime();
}

/** Epoch ms -> local wall time in `tz`. */
export function instantToLocal(ms: number, tz: string) {
  const d = new TZDate(ms, tz);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local wall time with a fixed UTC offset (minutes) -> epoch ms. */
export function localWithOffsetToInstant(local: string, offsetMinutes: number) {
  const { y, m, day, h, mi } = parts(local);
  return Date.UTC(y, m - 1, day, h, mi) - offsetMinutes * 60_000;
}

/** UTC offset in minutes implied by a local time and the instant it denotes. */
export function impliedOffset(local: string, ms: number) {
  return Math.round((localWithOffsetToInstant(local, 0) - ms) / 60_000);
}

export const dateOf = (local: string) => local.slice(0, 10);
export const timeOf = (local: string) => local.slice(11, 16);

/** Shift a local wall time by whole days. */
export function addDaysLocal(local: string, days: number) {
  const { y, m, day } = parts(local);
  const d = new Date(Date.UTC(y, m - 1, day + days));
  return `${d.toISOString().slice(0, 10)}${local.slice(10)}`;
}

/** Whole days from date a to date b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function eachDay(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysLocal(`${d}T00:00`, 1).slice(0, 10)) out.push(d);
  return out;
}

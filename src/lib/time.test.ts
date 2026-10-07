import { describe, expect, it } from "vitest";

import { addDaysLocal, daysBetween, eachDay, impliedOffset, instantToLocal, localToInstant } from "./time";

describe("time helpers", () => {
  it("round-trips local times across zones and DST", () => {
    const ms = localToInstant("2026-11-20T18:30", "Europe/London");
    expect(new Date(ms).toISOString()).toBe("2026-11-20T18:30:00.000Z");
    expect(instantToLocal(ms, "America/New_York")).toBe("2026-11-20T13:30");
    const summer = localToInstant("2026-07-01T09:00", "Europe/London");
    expect(new Date(summer).toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });

  it("derives a UTC offset from a local time and its instant", () => {
    const ms = localToInstant("2026-11-20T09:00", "Asia/Singapore");
    expect(impliedOffset("2026-11-20T09:00", ms)).toBe(480);
  });

  it("shifts and counts days", () => {
    expect(addDaysLocal("2026-12-31T23:10", 1)).toBe("2027-01-01T23:10");
    expect(daysBetween("2026-11-28", "2026-12-02")).toBe(4);
    expect(eachDay("2026-11-29", "2026-12-01")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });
});

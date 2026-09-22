import { describe, expect, it, vi } from "vitest";
import { getUpcomingHolidaysForRegion } from "./regional-holidays";
import { parseCalendarDate, parseDateOnly, toCalendarDate } from "./dates";

describe("calendar dates", () => {
  it("keeps the supplied day at local midnight, including daylight saving changes", () => {
    for (const value of ["2026-12-25", "2026-03-08", "2026-11-01", "2028-02-29"]) {
      const [year, month, day] = value.split("-").map(Number);
      const date = parseCalendarDate(value);
      expect([date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()])
        .toEqual([year, month, day, 0]);
    }
    expect(parseCalendarDate("2026-12-25").toLocaleDateString("en-US", { month: "long", day: "numeric" }))
      .toBe("December 25");
  });

  it("serializes local calendar dates without moving to the UTC day", () => {
    expect(toCalendarDate(new Date(2026, 11, 25, 0, 30))).toBe("2026-12-25");
    expect(toCalendarDate(new Date(2026, 11, 25, 23, 30))).toBe("2026-12-25");
  });

  it("keeps regional holiday dates and countdowns consistent across daylight saving", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 12));
    try {
      const holidays = getUpcomingHolidaysForRegion("north_america", 30);
      const christmas = holidays.find((holiday) => holiday.name === "Christmas");
      expect(christmas?.date).toBe("2026-12-25");
      expect(christmas?.daysUntil).toBe(55);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects missing, invalid, and timestamp values instead of rolling them into another day", () => {
    for (const value of [undefined, null, "", "invalid", "2026-02-29", "2026-13-01", "2026-00-00", "2026-12-25T00:00:00Z"]) {
      expect(parseDateOnly(value)).toBeNull();
    }
  });
});

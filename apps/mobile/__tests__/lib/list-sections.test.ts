import type { Holiday } from "@niftygifty/types";
import {
  filterListsBySection,
  getDefaultGiftCaptureList,
  getGiftListReminderDate,
  getPreferredGiftCaptureList,
  getListDeadlineState,
  getListSectionCounts,
  sortGiftCaptureLists,
  type ListSection,
} from "@/lib/list-sections";

function buildHoliday(overrides: Partial<Holiday>): Holiday {
  return {
    id: overrides.id || 1,
    name: overrides.name || "Holiday",
    date: overrides.date ?? "2026-12-25",
    icon: null,
    is_template: false,
    completed: false,
    archived: false,
    share_token: null,
    is_owner: true,
    role: "owner",
    collaborator_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("list-sections helpers", () => {
  const lists: Holiday[] = [
    buildHoliday({ id: 1, name: "Active", completed: false, archived: false }),
    buildHoliday({ id: 2, name: "Past", completed: true, archived: false }),
    buildHoliday({ id: 3, name: "Archived", completed: false, archived: true }),
  ];

  it("computes section counts", () => {
    expect(getListSectionCounts(lists)).toEqual({
      active: 1,
      past: 1,
      archived: 1,
      all: 3,
    });
  });

  it.each([
    ["active", [1]],
    ["past", [2]],
    ["archived", [3]],
    ["all", [1, 2, 3]],
  ] as Array<[ListSection, number[]]>)(
    "filters lists for %s section",
    (section, expectedIds) => {
      const result = filterListsBySection(lists, section).map((item) => item.id);
      expect(result).toEqual(expectedIds);
    }
  );

  it("prioritizes active upcoming lists for quick gift capture", () => {
    const captureLists = [
      buildHoliday({ id: 1, name: "Archived", archived: true, date: "2026-01-01" }),
      buildHoliday({ id: 2, name: "Future", date: "2026-12-25" }),
      buildHoliday({ id: 3, name: "Soon", date: "2026-06-01" }),
      buildHoliday({ id: 4, name: "Completed", completed: true, date: "2026-02-01" }),
    ];

    expect(sortGiftCaptureLists(captureLists).map((item) => item.id)).toEqual([3, 2, 4, 1]);
    expect(getDefaultGiftCaptureList(captureLists)?.id).toBe(3);
    expect(getPreferredGiftCaptureList(captureLists, 2)?.id).toBe(2);
    expect(getPreferredGiftCaptureList(captureLists, 999)?.id).toBe(3);
  });

  it("falls back to name ordering when capture dates are missing", () => {
    const captureLists = [
      buildHoliday({ id: 1, name: "Teachers", date: null }),
      buildHoliday({ id: 2, name: "Birthdays", date: null }),
    ];

    expect(sortGiftCaptureLists(captureLists).map((item) => item.id)).toEqual([2, 1]);
  });

  it("sorts filtered lists by planning priority", () => {
    const unsortedLists = [
      buildHoliday({ id: 1, name: "Later", date: "2026-12-25" }),
      buildHoliday({ id: 2, name: "Sooner", date: "2026-06-01" }),
      buildHoliday({ id: 3, name: "Archived", archived: true, date: "2026-01-01" }),
      buildHoliday({ id: 4, name: "Completed", completed: true, date: "2026-02-01" }),
    ];

    expect(filterListsBySection(unsortedLists, "all").map((item) => item.id)).toEqual([
      2,
      1,
      4,
      3,
    ]);
    expect(filterListsBySection(unsortedLists, "active").map((item) => item.id)).toEqual([
      2,
      1,
    ]);
  });

  it("returns deadline reminder labels for active dated lists", () => {
    const now = new Date(2026, 10, 25);

    expect(getListDeadlineState(buildHoliday({ date: "2026-11-24" }), now)).toEqual({
      daysUntil: -1,
      label: "1 day overdue",
      tone: "overdue",
    });
    expect(getListDeadlineState(buildHoliday({ date: "2026-11-25" }), now)).toEqual({
      daysUntil: 0,
      label: "Due today",
      tone: "today",
    });
    expect(getListDeadlineState(buildHoliday({ date: "2026-11-26" }), now)).toEqual({
      daysUntil: 1,
      label: "Due tomorrow",
      tone: "soon",
    });
    expect(getListDeadlineState(buildHoliday({ date: "2026-12-10" }), now)).toEqual({
      daysUntil: 15,
      label: "Due in 15 days",
      tone: "soon",
    });
  });

  it("does not show deadline reminders for completed, archived, missing, or distant lists", () => {
    const now = new Date(2026, 10, 25);

    expect(getListDeadlineState(buildHoliday({ completed: true, date: "2026-11-25" }), now)).toBeNull();
    expect(getListDeadlineState(buildHoliday({ archived: true, date: "2026-11-25" }), now)).toBeNull();
    expect(getListDeadlineState(buildHoliday({ date: null }), now)).toBeNull();
    expect(getListDeadlineState(buildHoliday({ date: "2026-12-31" }), now)).toBeNull();
  });

  it("schedules gift list reminders for the day before or deadline morning", () => {
    const list = buildHoliday({ date: "2026-06-10" });

    expect(getGiftListReminderDate(list, new Date("2026-06-01T12:00:00"))).toEqual(
      new Date("2026-06-09T09:00:00")
    );
    expect(getGiftListReminderDate(list, new Date("2026-06-09T12:00:00"))).toEqual(
      new Date("2026-06-10T09:00:00")
    );
    expect(getGiftListReminderDate(list, new Date("2026-06-10T12:00:00"))).toBeNull();
  });
});

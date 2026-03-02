import type { Holiday } from "@niftygifty/types";
import {
  filterListsBySection,
  getListSectionCounts,
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
});

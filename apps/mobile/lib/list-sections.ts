import type { Holiday } from "@niftygifty/types";

export type ListSection = "active" | "past" | "archived" | "all";

export const LIST_SECTION_OPTIONS: Array<{ key: ListSection; label: string }> = [
  { key: "active", label: "Active" },
  { key: "past", label: "Past" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

export function getListSectionCounts(lists: Holiday[]): Record<ListSection, number> {
  return {
    active: lists.filter((list) => !list.completed && !list.archived).length,
    past: lists.filter((list) => list.completed && !list.archived).length,
    archived: lists.filter((list) => list.archived).length,
    all: lists.length,
  };
}

export function filterListsBySection(lists: Holiday[], section: ListSection): Holiday[] {
  if (section === "active") {
    return lists.filter((list) => !list.completed && !list.archived);
  }

  if (section === "past") {
    return lists.filter((list) => list.completed && !list.archived);
  }

  if (section === "archived") {
    return lists.filter((list) => list.archived);
  }

  return lists;
}

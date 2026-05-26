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

function getDateSortValue(list: Holiday): number {
  if (!list.date) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = new Date(list.date).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

export function sortGiftCaptureLists(lists: Holiday[]): Holiday[] {
  return [...lists].sort((left, right) => {
    const leftArchived = left.archived ? 1 : 0;
    const rightArchived = right.archived ? 1 : 0;
    if (leftArchived !== rightArchived) {
      return leftArchived - rightArchived;
    }

    const leftCompleted = left.completed ? 1 : 0;
    const rightCompleted = right.completed ? 1 : 0;
    if (leftCompleted !== rightCompleted) {
      return leftCompleted - rightCompleted;
    }

    const dateDifference = getDateSortValue(left) - getDateSortValue(right);
    if (dateDifference !== 0) {
      return dateDifference;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getDefaultGiftCaptureList(lists: Holiday[]): Holiday | null {
  return sortGiftCaptureLists(lists)[0] ?? null;
}

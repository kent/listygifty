import type { Holiday } from "@niftygifty/types";
import { parseLocalDate } from "@/lib/formatters";

export type ListSection = "active" | "past" | "archived" | "all";
export type ListDeadlineTone = "overdue" | "today" | "soon";

export interface ListDeadlineState {
  daysUntil: number;
  label: string;
  tone: ListDeadlineTone;
}

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
    return sortGiftCaptureLists(lists.filter((list) => !list.completed && !list.archived));
  }

  if (section === "past") {
    return sortGiftCaptureLists(lists.filter((list) => list.completed && !list.archived));
  }

  if (section === "archived") {
    return sortGiftCaptureLists(lists.filter((list) => list.archived));
  }

  return sortGiftCaptureLists(lists);
}

function getDateSortValue(list: Holiday): number {
  if (!list.date) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = parseLocalDate(list.date).getTime();
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

export function getPreferredGiftCaptureList(
  lists: Holiday[],
  preferredListId: number | null
): Holiday | null {
  const sortedLists = sortGiftCaptureLists(lists);
  if (preferredListId) {
    const preferredList = sortedLists.find((list) => list.id === preferredListId);
    if (preferredList) {
      return preferredList;
    }
  }

  return sortedLists[0] ?? null;
}

function getStartOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalendarDayDifference(left: Date, right: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (getStartOfLocalDay(left).getTime() - getStartOfLocalDay(right).getTime()) /
      millisecondsPerDay
  );
}

export function getListDeadlineState(
  list: Holiday,
  now: Date = new Date()
): ListDeadlineState | null {
  if (!list.date || list.completed || list.archived) {
    return null;
  }

  const date = parseLocalDate(list.date);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const daysUntil = getCalendarDayDifference(date, now);
  if (daysUntil < 0) {
    return {
      daysUntil,
      label: daysUntil === -1 ? "1 day overdue" : `${Math.abs(daysUntil)} days overdue`,
      tone: "overdue",
    };
  }

  if (daysUntil === 0) {
    return {
      daysUntil,
      label: "Due today",
      tone: "today",
    };
  }

  if (daysUntil === 1) {
    return {
      daysUntil,
      label: "Due tomorrow",
      tone: "soon",
    };
  }

  if (daysUntil <= 30) {
    return {
      daysUntil,
      label: `Due in ${daysUntil} days`,
      tone: "soon",
    };
  }

  return null;
}

export function getGiftListReminderDate(
  list: Holiday,
  now: Date = new Date()
): Date | null {
  if (!list.date || list.completed || list.archived) {
    return null;
  }

  const deadline = parseLocalDate(list.date);
  if (Number.isNaN(deadline.getTime())) {
    return null;
  }

  const dayBefore = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate() - 1,
    9,
    0,
    0,
    0
  );
  if (dayBefore > now) {
    return dayBefore;
  }

  const deadlineMorning = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate(),
    9,
    0,
    0,
    0
  );
  return deadlineMorning > now ? deadlineMorning : null;
}

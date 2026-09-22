/** Calendar dates have no timezone; construct them in the viewer's local time. */
export function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(NaN);
  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : new Date(NaN);
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = parseCalendarDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toCalendarDate(date: Date): string {
  return [date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0")].join("-");
}

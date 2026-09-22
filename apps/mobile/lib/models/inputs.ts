const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function trim(value: string): string {
  return value.trim();
}

export function trimOrUndefined(value: string): string | undefined {
  const trimmed = trim(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidIsoDate(value: string): boolean {
  const text = trim(value);
  if (!ISO_DATE_PATTERN.test(text)) return false;
  const date = new Date(`${text}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function parseOptionalDecimal(value: string): number | undefined {
  const trimmed = trim(value);
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

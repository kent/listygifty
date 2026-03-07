const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function trim(value: string): string {
  return value.trim();
}

export function trimOrUndefined(value: string): string | undefined {
  const trimmed = trim(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(trim(value));
}

export function parseOptionalDecimal(value: string): number | undefined {
  const trimmed = trim(value);
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

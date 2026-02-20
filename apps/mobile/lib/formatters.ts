export function formatDate(
  dateString: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale?: string
): string | null {
  if (!dateString) {
    return null;
  }

  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  return parsedDate.toLocaleDateString(locale, options);
}

export function formatShortDate(dateString: string | null | undefined, locale?: string): string | null {
  return formatDate(
    dateString,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
    locale
  );
}

export function formatLongDate(dateString: string | null | undefined, locale?: string): string | null {
  return formatDate(
    dateString,
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
    locale
  );
}

export function formatCurrency(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number.parseFloat(value);

  if (!Number.isNaN(numericValue)) {
    return `$${numericValue.toFixed(2)}`;
  }

  return typeof value === "string" && value.startsWith("$") ? value : `$${String(value)}`;
}

export function formatBudgetRange(
  minBudget: string | null | undefined,
  maxBudget: string | null | undefined
): string | null {
  if (!minBudget && !maxBudget) {
    return null;
  }

  const minLabel = formatCurrency(minBudget) ?? "$0.00";
  const maxLabel = formatCurrency(maxBudget) ?? "No limit";

  return `${minLabel} - ${maxLabel}`;
}

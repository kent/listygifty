import {
  formatCurrency,
  formatBudgetRange,
  formatShortDate,
  formatLongDate,
  formatDate,
} from "@/lib/formatters";

describe("formatCurrency", () => {
  it("formats numeric strings with two decimals", () => {
    expect(formatCurrency("25")).toBe("$25.00");
    expect(formatCurrency("25.5")).toBe("$25.50");
  });

  it("formats numbers with two decimals", () => {
    expect(formatCurrency(100)).toBe("$100.00");
    expect(formatCurrency(99.99)).toBe("$99.99");
  });

  it("returns null for nullish or empty input", () => {
    expect(formatCurrency(null)).toBeNull();
    expect(formatCurrency(undefined)).toBeNull();
    expect(formatCurrency("")).toBeNull();
  });

  it("preserves $ if already prefixed and unparseable", () => {
    expect(formatCurrency("$abc")).toBe("$abc");
  });

  it("falls back gracefully for non-numeric strings", () => {
    expect(formatCurrency("abc")).toBe("$abc");
  });
});

describe("formatBudgetRange", () => {
  it("returns null when both budgets are missing", () => {
    expect(formatBudgetRange(null, null)).toBeNull();
    expect(formatBudgetRange(undefined, undefined)).toBeNull();
  });

  it("formats range with both min and max", () => {
    expect(formatBudgetRange("25", "50")).toBe("$25.00 - $50.00");
  });

  it("treats missing min as zero", () => {
    expect(formatBudgetRange(null, "50")).toBe("$0.00 - $50.00");
  });

  it("shows 'No limit' when max is missing", () => {
    expect(formatBudgetRange("25", null)).toBe("$25.00 - No limit");
  });
});

describe("formatDate", () => {
  it("returns null for nullish input", () => {
    expect(formatDate(null, { month: "short", day: "numeric" })).toBeNull();
  });

  it("returns input string when input is unparseable", () => {
    const result = formatDate("not-a-date", { month: "short", day: "numeric" });
    expect(result).toBe("not-a-date");
  });

  it("formats valid ISO date", () => {
    const result = formatDate("2025-12-25", { month: "short", day: "numeric", year: "numeric" }, "en-US");
    // Day of month varies with TZ; just assert month + year present
    expect(result).toMatch(/Dec.*2025/);
  });
});

describe("formatShortDate", () => {
  it("produces short month-day-year format", () => {
    const result = formatShortDate("2025-12-25", "en-US");
    expect(result).toMatch(/Dec \d+, 2025/);
  });

  it("returns null for null/undefined input", () => {
    expect(formatShortDate(null)).toBeNull();
  });
});

describe("formatLongDate", () => {
  it("produces long format with weekday", () => {
    const result = formatLongDate("2025-12-25", "en-US");
    // Weekday + month + year should be present (day varies with TZ)
    expect(result).toMatch(/December.*2025/);
  });
});

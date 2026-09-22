import { isValidIsoDate, parseOptionalDecimal } from "@/lib/models/inputs";

it.each(["2026-02-30", "2026-13-01", "2026-00-01", "2026-02-29"])("rejects impossible exchange dates: %s", (date) => {
  expect(isValidIsoDate(date)).toBe(false);
});
it("accepts a real leap day and blank optional budgets", () => {
  expect(isValidIsoDate("2028-02-29")).toBe(true);
  expect(parseOptionalDecimal(" ")).toBeUndefined();
  expect(parseOptionalDecimal("25.50")).toBe(25.5);
});
it("does not silently turn an invalid budget into a different amount", () => {
  expect(parseOptionalDecimal("25oops")).toBeNaN();
  expect(parseOptionalDecimal("25,50")).toBeNaN();
});

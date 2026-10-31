import { describe, expect, it } from "vitest";
import { defaultThemeFor } from "./themes";

describe("defaultThemeFor", () => {
  it("is Festive through November and December", () => {
    expect(defaultThemeFor(new Date(2026, 10, 1))).toBe("festive");
    expect(defaultThemeFor(new Date(2026, 11, 31))).toBe("festive");
  });

  it("is Apple for the rest of the year", () => {
    expect(defaultThemeFor(new Date(2026, 9, 31))).toBe("apple");
    expect(defaultThemeFor(new Date(2027, 0, 1))).toBe("apple");
    expect(defaultThemeFor(new Date(2027, 6, 15))).toBe("apple");
  });
});

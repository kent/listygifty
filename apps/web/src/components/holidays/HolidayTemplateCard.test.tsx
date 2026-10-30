import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Holiday } from "@niftygifty/types";
import { darkOnlyClasses } from "@/test/dark-only";
import { HolidayTemplateCard } from "./HolidayTemplateCard";

describe("holiday template card", () => {
  it("uses no dark-only colours", () => {
    render(<HolidayTemplateCard holiday={{ id: 1, name: "Christmas", icon: "gift" } as Holiday} onStartPlanning={vi.fn()} />);
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });
});

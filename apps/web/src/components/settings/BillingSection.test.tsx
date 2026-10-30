import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { darkOnlyClasses } from "@/test/dark-only";
import { BillingSection } from "./BillingSection";

describe("billing section", () => {
  it("uses no dark-only colours", () => {
    render(<BillingSection />);
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { relationshipCategoriesFor } from "./relationship-categories";

describe("relationshipCategoriesFor", () => {
  it("keeps business categories out of a personal workspace", () => {
    expect(relationshipCategoriesFor("personal")).toEqual(["family", "friends", "co-workers"]);
  });

  it("shows every category in a business workspace", () => {
    expect(relationshipCategoriesFor("business")).toContain("investors");
  });

  it("still shows the category someone is already filed under", () => {
    expect(relationshipCategoriesFor("personal", "vendors")).toEqual(["family", "friends", "co-workers", "vendors"]);
  });
});

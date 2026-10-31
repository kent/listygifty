import { RELATIONSHIP_CATEGORIES } from "@niftygifty/types";

const BUSINESS_CATEGORIES: readonly string[] = ["vendors", "partners", "investors"];

/** Vendors and investors mean nothing to a family. Anyone already filed under one keeps it. */
export function relationshipCategoriesFor(workspaceType?: string | null, current?: string | null) {
  if (workspaceType === "business") return [...RELATIONSHIP_CATEGORIES];
  return RELATIONSHIP_CATEGORIES.filter(
    (category) => !BUSINESS_CATEGORIES.includes(category) || category === current
  );
}

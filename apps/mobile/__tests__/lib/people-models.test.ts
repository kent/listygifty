import type { Person } from "@niftygifty/types";
import {
  buildPersonFormValues,
  filterPeople,
  getPeopleGroupCounts,
  type PeopleGroupFilter,
} from "@/lib/models";

function buildPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: overrides.id || 1,
    name: overrides.name || "Person",
    email: overrides.email || null,
    relationship: overrides.relationship || null,
    age: null,
    gender: null,
    notes: overrides.notes || null,
    gift_count: 0,
    user_id: 1,
    is_mine: true,
    is_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("people model helpers", () => {
  const people = [
    buildPerson({ id: 1, name: "Marie", relationship: "family" }),
    buildPerson({ id: 2, name: "Alex", relationship: "coworker", email: "alex@work.com" }),
    buildPerson({ id: 3, name: "Sam", relationship: "friend" }),
  ];

  it("builds group counts using normalized relationship groups", () => {
    expect(getPeopleGroupCounts(people)).toEqual({
      all: 3,
      family: 1,
      friends: 1,
      coworkers: 1,
      other: 0,
    });
  });

  it.each([
    ["all", "alex", [2]],
    ["family", "", [1]],
    ["coworkers", "work.com", [2]],
  ] as Array<[PeopleGroupFilter, string, number[]]>)(
    "filters people for %s with %s",
    (group, search, expectedIds) => {
      expect(filterPeople(people, search, group).map((person) => person.id)).toEqual(expectedIds);
    }
  );

  it("normalizes known relationship values when building form state", () => {
    const formValues = buildPersonFormValues(
      buildPerson({ relationship: " Partner ", email: "partner@example.com", notes: "  note  " })
    );

    expect(formValues).toEqual({
      name: "Person",
      relationship: "partner",
      email: "partner@example.com",
      notes: "  note  ",
    });
  });
});

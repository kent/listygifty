import type { CreatePersonRequest, Person } from "@niftygifty/types";
import { Ionicons } from "@expo/vector-icons";
import { trim, trimOrUndefined } from "./inputs";

export interface PersonFormValues {
  name: string;
  relationship: string;
  email: string;
  notes: string;
}

export type PeopleGroupFilter = "all" | "family" | "friends" | "coworkers" | "other";

export type RelationshipOption = {
  value: string;
  label: string;
  group: Exclude<PeopleGroupFilter, "all">;
  icon: keyof typeof Ionicons.glyphMap;
};

export const PEOPLE_GROUP_FILTERS: Array<{
  key: PeopleGroupFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "family", label: "Family", icon: "home-outline" },
  { key: "friends", label: "Friends", icon: "people-outline" },
  { key: "coworkers", label: "Coworkers", icon: "briefcase-outline" },
  { key: "other", label: "Other", icon: "pricetag-outline" },
];

export const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  { value: "family", label: "Family", group: "family", icon: "home-outline" },
  { value: "parent", label: "Parent", group: "family", icon: "people-outline" },
  { value: "sibling", label: "Sibling", group: "family", icon: "people-outline" },
  { value: "child", label: "Child", group: "family", icon: "person-outline" },
  { value: "partner", label: "Partner", group: "family", icon: "heart-outline" },
  { value: "spouse", label: "Spouse", group: "family", icon: "heart-outline" },
  { value: "relative", label: "Relative", group: "family", icon: "person-outline" },
  { value: "friend", label: "Friend", group: "friends", icon: "person-add-outline" },
  { value: "best-friend", label: "Best Friend", group: "friends", icon: "star-outline" },
  { value: "coworker", label: "Coworker", group: "coworkers", icon: "briefcase-outline" },
  { value: "manager", label: "Manager", group: "coworkers", icon: "ribbon-outline" },
  { value: "teammate", label: "Teammate", group: "coworkers", icon: "people-outline" },
  { value: "other", label: "Other", group: "other", icon: "pricetag-outline" },
];

const RELATIONSHIP_GROUP_BY_VALUE = RELATIONSHIP_OPTIONS.reduce(
  (lookup, option) => {
    lookup[option.value] = option.group;
    return lookup;
  },
  {} as Record<string, Exclude<PeopleGroupFilter, "all">>
);

const FAMILY_KEYWORDS = [
  "family",
  "mom",
  "mother",
  "dad",
  "father",
  "parent",
  "sister",
  "brother",
  "son",
  "daughter",
  "grandma",
  "grandmother",
  "grandpa",
  "grandfather",
  "aunt",
  "uncle",
  "cousin",
  "wife",
  "husband",
  "spouse",
  "partner",
];
const FRIEND_KEYWORDS = ["friend", "bestie", "buddy", "pal"];
const COWORKER_KEYWORDS = [
  "coworker",
  "co-worker",
  "colleague",
  "work",
  "boss",
  "manager",
  "team",
  "employee",
  "client",
];

export const EMPTY_PERSON_FORM_VALUES: PersonFormValues = {
  name: "",
  relationship: "",
  email: "",
  notes: "",
};

export function normalizeRelationship(relationship?: string | null): string {
  return (relationship || "").trim().toLowerCase();
}

export function getRelationshipOption(
  relationship?: string | null
): RelationshipOption | undefined {
  const normalized = normalizeRelationship(relationship);
  return RELATIONSHIP_OPTIONS.find((option) => option.value === normalized);
}

export function getRelationshipLabel(relationship?: string | null): string {
  const matchedOption = getRelationshipOption(relationship);
  if (matchedOption) {
    return matchedOption.label;
  }

  return (relationship || "").trim();
}

export function toRelationshipGroup(
  relationship?: string | null
): Exclude<PeopleGroupFilter, "all"> {
  const value = normalizeRelationship(relationship);
  if (!value) {
    return "other";
  }

  const mappedGroup = RELATIONSHIP_GROUP_BY_VALUE[value];
  if (mappedGroup) {
    return mappedGroup;
  }

  if (FAMILY_KEYWORDS.some((keyword) => value.includes(keyword))) {
    return "family";
  }

  if (FRIEND_KEYWORDS.some((keyword) => value.includes(keyword))) {
    return "friends";
  }

  if (COWORKER_KEYWORDS.some((keyword) => value.includes(keyword))) {
    return "coworkers";
  }

  return "other";
}

export function getPeopleGroupCounts(people: Person[]): Record<PeopleGroupFilter, number> {
  return people.reduce(
    (counts, person) => {
      counts[toRelationshipGroup(person.relationship)] += 1;
      counts.all += 1;
      return counts;
    },
    { all: 0, family: 0, friends: 0, coworkers: 0, other: 0 } as Record<
      PeopleGroupFilter,
      number
    >
  );
}

export function filterPeople(
  people: Person[],
  search: string,
  activeGroup: PeopleGroupFilter
): Person[] {
  const groupFilteredPeople =
    activeGroup === "all"
      ? people
      : people.filter((person) => toRelationshipGroup(person.relationship) === activeGroup);

  if (!search.trim()) {
    return groupFilteredPeople;
  }

  const value = search.trim().toLowerCase();
  return groupFilteredPeople.filter(
    (person) =>
      person.name.toLowerCase().includes(value) ||
      person.relationship?.toLowerCase().includes(value) ||
      person.email?.toLowerCase().includes(value)
  );
}

export function sortPeopleByName(people: Person[]): Person[] {
  return [...people].sort((left, right) => left.name.localeCompare(right.name));
}

export function getPersonInitial(person: Person): string {
  const trimmed = person.name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function buildPersonFormValues(person?: Person | null): PersonFormValues {
  if (!person) {
    return EMPTY_PERSON_FORM_VALUES;
  }

  const normalizedRelationship = normalizeRelationship(person.relationship);

  return {
    name: person.name,
    relationship: RELATIONSHIP_GROUP_BY_VALUE[normalizedRelationship]
      ? normalizedRelationship
      : (person.relationship || "").trim(),
    email: person.email || "",
    notes: person.notes || "",
  };
}

export function buildCreatePersonPayload(
  values: PersonFormValues
): CreatePersonRequest["person"] {
  return {
    name: trim(values.name),
    relationship: trimOrUndefined(values.relationship),
    email: trimOrUndefined(values.email),
    notes: trimOrUndefined(values.notes),
  };
}

export function buildUpdatePersonPayload(
  values: PersonFormValues
): Partial<CreatePersonRequest["person"]> {
  return {
    name: trim(values.name),
    relationship: trim(values.relationship),
    email: trim(values.email),
    notes: trim(values.notes),
  };
}

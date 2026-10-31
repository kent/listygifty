"use client";

import { useMemo, useState } from "react";
import type { Person } from "@niftygifty/types";
import { PeopleList } from "./PeopleList";
import { RelationshipFilter, type RelationshipFilterValue } from "./RelationshipFilter";

interface FavouritesSectionProps {
  people: Person[];
}

export function FavouritesSection({ people }: FavouritesSectionProps) {
  const [filter, setFilter] = useState<RelationshipFilterValue>("all");

  const filteredPeople = useMemo(() => {
    // Only show people with gifts
    let result = people.filter((p) => p.gift_count > 0);

    // Filter by relationship
    if (filter !== "all") {
      result = result.filter((p) => {
        if (filter === "other") {
          return !p.relationship || p.relationship === "other";
        }
        return p.relationship === filter;
      });
    }

    // Sort by gift count (desc), then by name
    return result.sort((a, b) => {
      if (b.gift_count !== a.gift_count) {
        return b.gift_count - a.gift_count;
      }
      return a.name.localeCompare(b.name);
    });
  }, [people, filter]);

  return (
    <div>
      <RelationshipFilter value={filter} onChange={setFilter} />
      <PeopleList
        people={filteredPeople}
        emptyTitle="Nobody Has Gifts Yet"
        emptyDescription={
          filter === "all"
            ? "People with the most gifts will appear here"
            : `No favourites in the "${filter}" category`
        }
      />
    </div>
  );
}


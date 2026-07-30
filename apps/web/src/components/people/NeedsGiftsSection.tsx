"use client";

import { useMemo } from "react";
import type { Person } from "@niftygifty/types";
import { PeopleList } from "./PeopleList";

interface NeedsGiftsSectionProps {
  people: Person[];
}

export function NeedsGiftsSection({ people }: NeedsGiftsSectionProps) {
  const peopleWithoutGifts = useMemo(() => {
    return people
      .filter((person) => person.gift_count === 0)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [people]);

  return (
    <PeopleList
      people={peopleWithoutGifts}
      emptyTitle="Everyone Has Gifts"
      emptyDescription="People without gifts will appear here when they need attention."
    />
  );
}

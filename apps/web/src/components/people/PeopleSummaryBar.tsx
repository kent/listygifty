"use client";

import { CalendarClock, Gift, Search, Users } from "lucide-react";
import { summarizePeople, type Person } from "@niftygifty/types";
import { cn } from "@/lib/utils";

interface PeopleSummaryBarProps {
  people: Person[];
  visiblePeople: Person[];
  hasSearch: boolean;
  className?: string;
}

export function PeopleSummaryBar({
  people,
  visiblePeople,
  hasSearch,
  className,
}: PeopleSummaryBarProps) {
  const summary = summarizePeople(people);
  const visibleSummary = summarizePeople(visiblePeople);
  const items = [
    {
      icon: Users,
      label: "People",
      value: summary.totalPeople.toString(),
      detail: `${summary.sharedPeopleCount} shared`,
      accent: "text-violet-600 dark:text-violet-400",
    },
    {
      icon: Gift,
      label: "Need Gifts",
      value: summary.withoutGiftsCount.toString(),
      detail:
        summary.withoutGiftsCount === 0
          ? "Everyone covered"
          : "No gifts yet",
      accent:
        summary.withoutGiftsCount === 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400",
    },
    {
      icon: CalendarClock,
      label: "Upcoming",
      value: summary.upcomingDateCount.toString(),
      detail: "Next 30 days",
      accent: "text-sky-600 dark:text-sky-400",
    },
    {
      icon: Search,
      label: "Visible",
      value: visibleSummary.totalPeople.toString(),
      detail: hasSearch ? "Search results" : "Current view",
      accent: "text-slate-600 dark:text-slate-300",
    },
  ];

  return (
    <section className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)} aria-label="People summary">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-xl font-semibold text-slate-950 dark:text-white">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {item.detail}
                </p>
              </div>
              <Icon className={cn("h-5 w-5 shrink-0", item.accent)} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

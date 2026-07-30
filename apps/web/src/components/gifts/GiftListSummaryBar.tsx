"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { summarizeGifts, type Gift, type GiftStatus } from "@niftygifty/types";

interface GiftListSummaryBarProps {
  gifts: Gift[];
  filteredGifts: Gift[];
  statuses: GiftStatus[];
  holidayDate: string | null;
  hasActiveFilters: boolean;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day);
  }

  return new Date(dateString);
}

function getDeadlineCopy(holidayDate: string | null): { value: string; detail: string } {
  if (!holidayDate) {
    return { value: "No date", detail: "Add a deadline" };
  }

  const target = parseLocalDate(holidayDate);
  if (Number.isNaN(target.getTime())) {
    return { value: "Date set", detail: holidayDate };
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDifference = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000
  );

  if (dayDifference === 0) {
    return { value: "Today", detail: "Gift deadline" };
  }

  if (dayDifference < 0) {
    const daysOverdue = Math.abs(dayDifference);
    return {
      value: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago`,
      detail: "Past deadline",
    };
  }

  return {
    value: `${dayDifference} day${dayDifference === 1 ? "" : "s"}`,
    detail: "Until deadline",
  };
}

export function GiftListSummaryBar({
  gifts,
  filteredGifts,
  statuses,
  holidayDate,
  hasActiveFilters,
  className,
}: GiftListSummaryBarProps) {
  const summary = summarizeGifts(gifts, statuses);
  const visibleSummary = summarizeGifts(filteredGifts, statuses);
  const deadline = getDeadlineCopy(holidayDate);
  const unassignedDetail =
    summary.unassignedGiftCount === 0
      ? "All gifts assigned"
      : `${summary.unassignedGiftCount} need recipients`;
  const pricingDetail =
    summary.unpricedGiftCount === 0
      ? "All priced"
      : `${summary.unpricedGiftCount} missing price${summary.unpricedGiftCount === 1 ? "" : "s"}`;

  const items = [
    {
      icon: CheckCircle2,
      label: "Progress",
      value:
        summary.totalGifts === 0
          ? "No gifts"
          : `${summary.completedGiftCount}/${summary.totalGifts}`,
      detail:
        summary.totalGifts === 0
          ? "Start the list"
          : `${summary.completionPercent}% complete`,
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: CircleDollarSign,
      label: "Planned Spend",
      value: formatCurrency(summary.totalCost),
      detail: pricingDetail,
      accent: "text-violet-600 dark:text-violet-400",
    },
    {
      icon: AlertTriangle,
      label: "Recipients",
      value:
        summary.unassignedGiftCount === 0
          ? "Ready"
          : `${summary.unassignedGiftCount} open`,
      detail: unassignedDetail,
      accent:
        summary.unassignedGiftCount === 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400",
    },
    {
      icon: CalendarClock,
      label: "Deadline",
      value: deadline.value,
      detail: deadline.detail,
      accent: "text-sky-600 dark:text-sky-400",
    },
  ];

  return (
    <section className={cn("space-y-3", className)} aria-label="Gift list summary">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
          <span>Filtered view</span>
          <Badge variant="secondary">{visibleSummary.totalGifts} gifts</Badge>
          <Badge variant="secondary">{formatCurrency(visibleSummary.totalCost)}</Badge>
          {visibleSummary.unassignedGiftCount > 0 && (
            <Badge variant="outline">
              {visibleSummary.unassignedGiftCount} unassigned
            </Badge>
          )}
        </div>
      )}
    </section>
  );
}

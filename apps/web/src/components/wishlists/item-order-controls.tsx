"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The item's rank, for lists shown in the owner's order. */
export function ItemRank({ rank }: { rank: number }) {
  return (
    <span
      aria-label={`Rank ${rank}`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
    >
      {rank}
    </span>
  );
}

/** Move up and move down buttons for one item in an ordered list. */
export function ItemOrderControls({
  rank,
  total,
  itemName,
  onMove,
  disabled = false,
}: {
  rank: number;
  total: number;
  itemName: string;
  onMove: (delta: -1 | 1) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-11 sm:size-8"
        aria-label={`Move ${itemName} up`}
        title="Move up"
        disabled={disabled || rank === 1}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-11 sm:size-8"
        aria-label={`Move ${itemName} down`}
        title="Move down"
        disabled={disabled || rank === total}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

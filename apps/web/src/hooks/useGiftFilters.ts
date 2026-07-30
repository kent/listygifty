import { useState, useMemo, useCallback } from "react";
import {
  DEFAULT_GIFT_FILTERS,
  giftMatchesSearch,
  type CostRange,
  type Gift,
  type GiftFilterState,
} from "@niftygifty/types";

interface CostRangeBounds {
  min: number | null;
  max: number | null;
}

const COST_RANGES: Record<Exclude<CostRange, "custom">, CostRangeBounds> = {
  under25: { min: null, max: 25 },
  "25to50": { min: 25, max: 50 },
  "50to100": { min: 50, max: 100 },
  over100: { min: 100, max: null },
};

function matchesCostRange(cost: string | null, range: CostRange | null): boolean {
  if (!range) return true;
  if (!cost) return range === "under25"; // No cost counts as $0

  const costNum = parseFloat(cost);
  if (isNaN(costNum)) return true;

  if (range === "custom") return true; // Custom handled separately

  const bounds = COST_RANGES[range];
  const aboveMin = bounds.min === null || costNum >= bounds.min;
  const belowMax = bounds.max === null || costNum < bounds.max;
  return aboveMin && belowMax;
}

export function useGiftFilters(gifts: Gift[]) {
  const [filters, setFilters] = useState<GiftFilterState>(DEFAULT_GIFT_FILTERS);

  const updateFilter = useCallback(<K extends keyof GiftFilterState>(
    key: K,
    value: GiftFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_GIFT_FILTERS);
  }, []);

  const filteredGifts = useMemo(() => {
    return gifts.filter((gift) => {
      // Text search
      if (!giftMatchesSearch(gift, filters.search)) return false;

      // Status filter
      if (filters.statusIds.length > 0) {
        if (!filters.statusIds.includes(gift.gift_status_id)) return false;
      }

      // Recipient filter
      if (filters.recipientIds.length > 0) {
        const giftRecipientIds = gift.recipients.map((r) => r.id);
        if (!filters.recipientIds.some((id) => giftRecipientIds.includes(id))) {
          return false;
        }
      }

      // Giver filter
      if (filters.giverIds.length > 0) {
        const giftGiverIds = gift.givers.map((g) => g.id);
        if (!filters.giverIds.some((id) => giftGiverIds.includes(id))) {
          return false;
        }
      }

      // Cost range filter
      if (!matchesCostRange(gift.cost, filters.costRange)) return false;

      return true;
    });
  }, [gifts, filters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== "" ||
      filters.statusIds.length > 0 ||
      filters.recipientIds.length > 0 ||
      filters.giverIds.length > 0 ||
      filters.costRange !== null
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.statusIds.length > 0) count++;
    if (filters.recipientIds.length > 0) count++;
    if (filters.giverIds.length > 0) count++;
    if (filters.costRange) count++;
    return count;
  }, [filters]);

  return {
    filters,
    filteredGifts,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}

import type {
  CreateGiftRequest,
  Gift,
  GiftStatus,
  UpdateGiftRequest,
} from "@niftygifty/types";
import { parseOptionalDecimal, trim, trimOrUndefined } from "./inputs";

export interface GiftFormValues {
  name: string;
  description: string;
  link: string;
  cost: string;
  giftStatusId: number | null;
  recipientIds: number[];
  giverIds: number[];
}

export interface GiftFilterValues {
  search: string;
  statusIds: number[];
}

export const EMPTY_GIFT_FORM_VALUES: GiftFormValues = {
  name: "",
  description: "",
  link: "",
  cost: "",
  giftStatusId: null,
  recipientIds: [],
  giverIds: [],
};

export function buildGiftFormValues(gift: Gift): GiftFormValues {
  return {
    name: gift.name,
    description: gift.description || "",
    link: gift.link || "",
    cost: gift.cost || "",
    giftStatusId: gift.gift_status_id,
    recipientIds: gift.recipients.map((recipient) => recipient.id),
    giverIds: gift.givers.map((giver) => giver.id),
  };
}

export function getResolvedGiftStatusId(
  values: GiftFormValues,
  statuses: GiftStatus[]
): number | null {
  return values.giftStatusId ?? statuses[0]?.id ?? null;
}

function buildSharedGiftPayload(
  values: GiftFormValues,
  giftStatusId: number
): Omit<CreateGiftRequest["gift"], "holiday_id"> {
  return {
    name: trim(values.name),
    description: trimOrUndefined(values.description),
    link: trimOrUndefined(values.link),
    cost: parseOptionalDecimal(values.cost),
    gift_status_id: giftStatusId,
    recipient_ids: values.recipientIds.length > 0 ? values.recipientIds : undefined,
    giver_ids: values.giverIds.length > 0 ? values.giverIds : undefined,
  };
}

export function buildCreateGiftPayload(
  holidayId: number,
  values: GiftFormValues,
  giftStatusId: number
): CreateGiftRequest["gift"] {
  return {
    ...buildSharedGiftPayload(values, giftStatusId),
    holiday_id: holidayId,
  };
}

export function buildUpdateGiftPayload(
  values: GiftFormValues,
  giftStatusId: number
): UpdateGiftRequest["gift"] {
  return buildSharedGiftPayload(values, giftStatusId);
}

function areIdListsEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function giftFormHasChanges(gift: Gift | null, values: GiftFormValues): boolean {
  if (!gift) {
    return false;
  }

  return (
    values.name !== gift.name ||
    values.description !== (gift.description || "") ||
    values.link !== (gift.link || "") ||
    values.cost !== (gift.cost || "") ||
    values.giftStatusId !== gift.gift_status_id ||
    !areIdListsEqual(values.recipientIds, gift.recipients.map((recipient) => recipient.id)) ||
    !areIdListsEqual(values.giverIds, gift.givers.map((giver) => giver.id))
  );
}

export function filterGifts(gifts: Gift[], filters: GiftFilterValues): Gift[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return gifts.filter((gift) => {
    if (normalizedSearch) {
      const matchesSearch =
        gift.name.toLowerCase().includes(normalizedSearch) ||
        gift.description?.toLowerCase().includes(normalizedSearch) ||
        gift.recipients?.some((recipient) =>
          recipient.name.toLowerCase().includes(normalizedSearch)
        );

      if (!matchesSearch) {
        return false;
      }
    }

    if (filters.statusIds.length > 0 && !filters.statusIds.includes(gift.gift_status_id)) {
      return false;
    }

    return true;
  });
}

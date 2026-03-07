import type { CreateWishlistItemRequest } from "@niftygifty/types";
import { parseOptionalDecimal, trim, trimOrUndefined } from "./inputs";

export interface WishlistItemFormValues {
  name: string;
  description: string;
  link: string;
  price: string;
}

export const EMPTY_WISHLIST_ITEM_FORM_VALUES: WishlistItemFormValues = {
  name: "",
  description: "",
  link: "",
  price: "",
};

export function buildCreateWishlistItemPayload(
  values: WishlistItemFormValues
): CreateWishlistItemRequest["wishlist_item"] {
  return {
    name: trim(values.name),
    description: trimOrUndefined(values.description),
    link: trimOrUndefined(values.link),
    price: parseOptionalDecimal(values.price),
  };
}

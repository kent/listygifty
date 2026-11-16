import { useCallback, useMemo, useState } from "react";
import type { WishlistItem } from "@niftygifty/types";
import { haptics } from "@/lib/haptics";
import { humanizeError } from "@/lib/error-message";
import { useServices } from "@/lib/use-api";

const TAKEN_MESSAGE = "Someone is already getting this one. Pick something else?";

// Marking what you're getting on a list an exchange lets you see. Everyone
// else who can see the list finds the item taken. Its owner never does.
export function useWishlistMarks(exchangeId: number | undefined, loaded: WishlistItem[]) {
  const { wishlistItems } = useServices();
  // Items as the API last answered for them, over what the screen loaded.
  const [saved, setSaved] = useState<Record<number, WishlistItem>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => loaded.map((item) => saved[item.id] ?? item), [loaded, saved]);
  // An older API doesn't say what's taken, so there is nothing safe to offer.
  const canMark = exchangeId !== undefined && items.some((item) => item.is_available !== undefined);

  const run = useCallback(
    async (item: WishlistItem, action: (exchangeId: number) => Promise<WishlistItem>) => {
      if (exchangeId === undefined || busy) return;
      setBusy(true);
      setError(null);
      try {
        const answer = await action(exchangeId);
        setSaved((current) => ({ ...current, [item.id]: answer }));
        await haptics.success();
      } catch (failure) {
        if ((failure as { status?: number } | null)?.status === 409) {
          // Someone marked it after this screen loaded.
          setSaved((current) => ({ ...current, [item.id]: { ...item, is_available: false, my_claim: null } }));
          setError(TAKEN_MESSAGE);
        } else {
          setError(humanizeError(failure, "Could not save that. Try again."));
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, exchangeId]
  );

  const reserve = useCallback(
    (item: WishlistItem) => run(item, (id) => wishlistItems.claim(id, item.exchange_participant_id, item.id, false)),
    [run, wishlistItems]
  );
  // A reserved item is upgraded. An open one is bought in one step.
  const buy = useCallback(
    (item: WishlistItem) =>
      run(item, (id) =>
        item.my_claim
          ? wishlistItems.markPurchased(id, item.exchange_participant_id, item.id)
          : wishlistItems.claim(id, item.exchange_participant_id, item.id, true)
      ),
    [run, wishlistItems]
  );
  const undo = useCallback(
    (item: WishlistItem) => run(item, (id) => wishlistItems.unclaim(id, item.exchange_participant_id, item.id)),
    [run, wishlistItems]
  );

  return { items, canMark, busy, error, reserve, buy, undo };
}

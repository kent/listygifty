"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Gift, Image, List, MessageCircle } from "lucide-react";
import type { WishlistItem } from "@niftygifty/types";
import { giftExchangesService, wishlistItemsService } from "@/services";
import { ApiError } from "@/lib/api-client";
import { humanizeError } from "@/lib/error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ItemRank } from "@/components/wishlists/item-order-controls";

interface MatchWishlistProps {
  exchangeId: number;
  matchName: string;
  items: WishlistItem[];
  // False once the match has deleted their account.
  canNudge: boolean;
  headingLevel?: 2 | 3;
}

type NudgeState = "idle" | "sending" | "sent";

function nudgeLabel(state: NudgeState, empty: boolean) {
  if (state === "sending") return "Sending...";
  if (state === "sent") return "Request sent";
  return empty ? "Ask for ideas" : "Ask for more ideas";
}

// What you're getting for this person. Anyone else who can see the list finds
// the item taken. The person whose list it is never does.
function ItemMark({
  item,
  busy,
  onMark,
  onMarkBought,
  onUndo,
}: {
  item: WishlistItem;
  busy: boolean;
  onMark: (purchased: boolean) => void;
  onMarkBought: () => void;
  onUndo: () => void;
}) {
  // An older API doesn't say what's taken, so there is nothing safe to offer.
  if (item.is_available === undefined) return null;

  if (item.my_claim) {
    const bought = item.my_claim.status === "purchased";
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Badge
          className={
            bought
              ? "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50"
              : "bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500/50"
          }
        >
          <Check className="h-3 w-3 mr-1" />
          {bought ? "Bought" : "Reserved"}
        </Badge>
        {!bought && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onMarkBought} aria-label={`Mark ${item.name} as bought`}>
            Mark bought
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={onUndo} aria-label={`Undo your mark on ${item.name}`}>
          Undo
        </Button>
      </div>
    );
  }

  if (!item.is_available) {
    return (
      <div className="mt-3">
        <Badge className="bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/50">Someone has this</Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onMark(false)} aria-label={`Reserve ${item.name}`}>
        Reserve
      </Button>
      <Button size="sm" disabled={busy} onClick={() => onMark(true)} aria-label={`Mark ${item.name} as bought`}>
        Bought
      </Button>
    </div>
  );
}

// The match's wishlist in their order. An empty one asks them for ideas
// without saying who asked.
export function MatchWishlist({ exchangeId, matchName, items, canNudge, headingLevel = 2 }: MatchWishlistProps) {
  const [nudge, setNudge] = useState<NudgeState>("idle");
  // Items as the API last answered for them, over what the page loaded.
  const [saved, setSaved] = useState<Record<number, WishlistItem>>({});
  const [marking, setMarking] = useState(false);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const empty = items.length === 0;
  const shown = items.map((item) => saved[item.id] ?? item);
  const canMark = shown.some((item) => item.is_available !== undefined);

  const runMark = async (item: WishlistItem, action: () => Promise<WishlistItem>) => {
    setMarking(true);
    try {
      const answer = await action();
      setSaved((current) => ({ ...current, [item.id]: answer }));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone marked it after this page loaded.
        setSaved((current) => ({ ...current, [item.id]: { ...item, is_available: false, my_claim: null } }));
        toast.error("Someone is already getting this one. Pick something else?");
      } else {
        toast.error(humanizeError(err, "Could not save that. Try again."));
      }
    } finally {
      setMarking(false);
    }
  };
  const label = nudgeLabel(nudge, empty);

  const handleNudge = async () => {
    setNudge("sending");
    try {
      await giftExchangesService.nudgeMatch(exchangeId);
      setNudge("sent");
      toast.success("Anonymous request sent");
    } catch (err: unknown) {
      setNudge("idle");
      toast.error(humanizeError(err, "Could not send request"));
    }
  };

  const nudgeButton = canNudge && (
    <Button
      variant={empty ? "default" : "outline"}
      onClick={handleNudge}
      disabled={nudge !== "idle"}
      aria-label={nudge === "idle" ? `${label} from ${matchName} anonymously` : undefined}
      className={empty ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600" : undefined}
    >
      <MessageCircle className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );

  return (
    <section data-testid="match-wishlist">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Heading className="min-w-0 break-words text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <List className="h-5 w-5 shrink-0 text-violet-500 dark:text-violet-400" />
          <span className="min-w-0 break-words">{matchName}&apos;s wishlist</span>
        </Heading>
        {!empty && nudgeButton}
      </div>

      {canMark && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Mark what you&apos;re getting so nobody doubles up. {matchName} can&apos;t see it.
        </p>
      )}

      {empty ? (
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <CardContent className="py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4">
              <Gift className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No ideas yet</p>
            <p className="break-words text-slate-600 dark:text-slate-400">
              {matchName} hasn&apos;t added anything to their wishlist.
            </p>
            {nudgeButton ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                {nudgeButton}
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {nudge === "sent"
                    ? "We'll email you when they add one."
                    : "We'll email them. They won't know it was you."}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-slate-600 dark:text-slate-400">Check back later.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {shown.map((item, index) => (
            <li key={item.id}>
              <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <ItemRank rank={index + 1} />
                    {item.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-20 h-20 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="h-8 w-8 text-slate-400 dark:text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="break-words font-semibold text-slate-900 dark:text-white text-lg">{item.name}</p>
                      {item.description && (
                        <p className="break-words text-sm text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                        {(item.price_display || item.price) && (
                          <span className="text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {item.price_display || `$${parseFloat(item.price!).toFixed(2)}`}
                          </span>
                        )}
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 bg-violet-500/10 px-2 py-1 rounded"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Product
                          </a>
                        )}
                      </div>
                      <ItemMark
                        item={item}
                        busy={marking}
                        onMark={(purchased) =>
                          runMark(item, () =>
                            wishlistItemsService.claim(exchangeId, item.exchange_participant_id, item.id, purchased)
                          )
                        }
                        onMarkBought={() =>
                          runMark(item, () =>
                            wishlistItemsService.markPurchased(exchangeId, item.exchange_participant_id, item.id)
                          )
                        }
                        onUndo={() =>
                          runMark(item, () => wishlistItemsService.unclaim(exchangeId, item.exchange_participant_id, item.id))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

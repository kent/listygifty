"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Gift, Image, List, MessageCircle } from "lucide-react";
import type { WishlistItem } from "@niftygifty/types";
import { giftExchangesService } from "@/services";
import { humanizeError } from "@/lib/error-message";
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

// The match's wishlist in their order. An empty one asks them for ideas
// without saying who asked.
export function MatchWishlist({ exchangeId, matchName, items, canNudge, headingLevel = 2 }: MatchWishlistProps) {
  const [nudge, setNudge] = useState<NudgeState>("idle");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const empty = items.length === 0;
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
          {items.map((item, index) => (
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

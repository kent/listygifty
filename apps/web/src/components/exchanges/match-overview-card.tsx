import Link from "next/link";
import { Gift, List, Sparkles } from "lucide-react";
import type { ExchangeParticipantWithWishlist } from "@niftygifty/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MatchOverviewCardProps {
  match: ExchangeParticipantWithWishlist;
  exchangeSlug: string;
}

export function MatchOverviewCard({ match, exchangeSlug }: MatchOverviewCardProps) {
  const wishlistCount = match.wishlist_items?.length ?? match.wishlist_count;
  const wishlistLabel = wishlistCount === 1 ? "1 wishlist idea" : `${wishlistCount} wishlist ideas`;

  return (
    <Card
      data-testid="match-overview"
      className="mb-6 overflow-hidden border-violet-300/60 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-amber-500/10 shadow-lg shadow-violet-500/5 dark:border-violet-500/30"
    >
      <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
            Your match
          </div>
          <p className="mb-1 text-sm text-slate-600 dark:text-slate-400">
            You&apos;re getting a gift for
          </p>
          <h2 className="text-3xl font-bold text-slate-950 dark:text-white md:text-4xl">
            {match.display_name}
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            {wishlistCount > 0
              ? `${match.display_name} has shared ${wishlistLabel} to get you started.`
              : `${match.display_name} hasn’t shared any ideas yet. You can ask anonymously.`}
          </p>
        </div>

        <div className="flex min-w-56 flex-col gap-2">
          <Link href={`/exchanges/${exchangeSlug}/my-match`}>
            <Button className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600">
              <Gift className="mr-2 h-4 w-4" />
              See {match.display_name}&apos;s wishlist
            </Button>
          </Link>
          <Link href={`/exchanges/${exchangeSlug}/my-wishlist`}>
            <Button variant="outline" className="w-full border-slate-300 dark:border-slate-700">
              <List className="mr-2 h-4 w-4" />
              Update my wishlist
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

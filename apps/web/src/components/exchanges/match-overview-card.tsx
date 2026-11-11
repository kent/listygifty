import Link from "next/link";
import { List, Sparkles } from "lucide-react";
import type { ExchangeParticipantWithWishlist } from "@niftygifty/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatchWishlist } from "@/components/exchanges/match-wishlist";

interface MatchOverviewCardProps {
  match: ExchangeParticipantWithWishlist;
  exchangeId: number;
  exchangeSlug: string;
  canNudge: boolean;
}

export function MatchOverviewCard({ match, exchangeId, exchangeSlug, canNudge }: MatchOverviewCardProps) {
  return (
    <Card
      data-testid="match-overview"
      className="mb-6 overflow-hidden border-violet-300/60 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-amber-500/10 shadow-lg shadow-violet-500/5 dark:border-violet-500/30"
    >
      <CardContent className="space-y-6 p-6 md:p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-700 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
              Your match
            </div>
            <p className="mb-1 text-sm text-slate-600 dark:text-slate-400">
              You&apos;re getting a gift for
            </p>
            <h2 className="break-words text-3xl font-bold text-slate-950 dark:text-white md:text-4xl">
              {match.display_name}
            </h2>
          </div>

          <Button asChild variant="outline" className="border-slate-300 dark:border-slate-700 md:w-64">
            <Link href={`/exchanges/${exchangeSlug}/my-wishlist`}>
              <List className="mr-2 h-4 w-4" />
              Update my wishlist
            </Link>
          </Button>
        </div>

        <MatchWishlist
          exchangeId={exchangeId}
          matchName={match.display_name}
          items={match.wishlist_items ?? []}
          canNudge={canNudge}
          headingLevel={3}
        />
      </CardContent>
    </Card>
  );
}

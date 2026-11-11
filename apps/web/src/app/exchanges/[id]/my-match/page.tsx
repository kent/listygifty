"use client";

import { parseCalendarDate } from "@/lib/dates";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { giftExchangesService, exchangeParticipantsService } from "@/services";
import { signInUrlForCurrentPage } from "@/lib/sign-in-redirect";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatchWishlist } from "@/components/exchanges/match-wishlist";
import { ArrowLeft, Gift, DollarSign, Calendar, List } from "lucide-react";
import type { GiftExchange, ExchangeParticipantWithWishlist } from "@niftygifty/types";

export default function MyMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = use(params);
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const [exchange, setExchange] = useState<GiftExchange | null>(null);
  const [match, setMatch] = useState<ExchangeParticipantWithWishlist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(signInUrlForCurrentPage());
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        const exchangeData = await giftExchangesService.getBySlug(slug);
        setExchange(exchangeData);

        // Get my participant with match info
        if (exchangeData.my_participant?.matched_participant_id) {
          const matchData = await exchangeParticipantsService.getById(
            exchangeData.id,
            exchangeData.my_participant.matched_participant_id
          );
          setMatch(matchData as ExchangeParticipantWithWishlist);
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, slug]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!exchange || !exchange.my_participant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">You are not a participant in this exchange</p>
          <Link href="/exchanges">
            <Button className="mt-4">Back to Exchanges</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (exchange.status !== "active" && exchange.status !== "completed") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Gift className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Matches Not Ready Yet</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            The exchange organizer has not started the matching yet.
          </p>
          <Link href={`/exchanges/${slug}`}>
            <Button>Back to Exchange</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Could not load your match</p>
          <Link href={`/exchanges/${slug}`}>
            <Button className="mt-4">Back to Exchange</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            href={`/exchanges/${slug}`}
            className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {exchange.name}
          </Link>
          {/* After the draw, Home sends people here, so this is the way back to their own list. */}
          <Button asChild variant="outline" size="sm">
            <Link href={`/exchanges/${slug}/my-wishlist`}>
              <List className="h-4 w-4 mr-2" />
              Your wishlist
            </Link>
          </Button>
        </div>

        {/* Match Reveal Card */}
        <Card className="border-amber-200 dark:border-slate-800 bg-gradient-to-br from-amber-500/10 to-orange-500/10 mb-8">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-amber-800 dark:text-amber-400 mb-2">You are getting a gift for...</p>
            <h1 className="break-words text-4xl font-bold text-slate-900 dark:text-white mb-4">🎁 {match.display_name}</h1>
            {exchange.exchange_date && (
              <p className="text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" />
                Gift needed by{" "}
                {parseCalendarDate(exchange.exchange_date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
            {(exchange.budget_min || exchange.budget_max) && (
              <p className="text-slate-600 dark:text-slate-400 mt-1 flex items-center justify-center gap-2">
                <DollarSign className="h-4 w-4" />
                Budget:{" "}
                {exchange.budget_min && exchange.budget_max
                  ? `$${parseFloat(exchange.budget_min).toFixed(0)} - $${parseFloat(exchange.budget_max).toFixed(0)}`
                  : exchange.budget_max
                  ? `Up to $${parseFloat(exchange.budget_max).toFixed(0)}`
                  : `At least $${parseFloat(exchange.budget_min!).toFixed(0)}`}
              </p>
            )}
          </CardContent>
        </Card>

        <MatchWishlist
          exchangeId={exchange.id}
          matchName={match.display_name}
          items={match.wishlist_items ?? []}
          canNudge={exchange.capabilities.nudge_match}
        />

        <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-8">
          🤫 Remember: Keep your match a secret!
        </p>
      </main>
    </div>
  );
}

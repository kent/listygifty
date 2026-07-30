"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { giftExchangesService, exchangeParticipantsService, AUTH_ROUTES } from "@/services";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Gift, DollarSign, ExternalLink, Image, Calendar, List, MessageCircle } from "lucide-react";
import { toast } from "sonner";
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
  const [nudging, setNudging] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
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

  const wishlistItems = match.wishlist_items || [];

  const handleNudge = async () => {
    setNudging(true);
    try {
      await giftExchangesService.nudgeMatch(exchange.id);
      toast.success("Anonymous request sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send request");
    } finally {
      setNudging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href={`/exchanges/${slug}`}
          className="inline-flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to {exchange.name}
        </Link>

        {/* Match Reveal Card */}
        <Card className="border-amber-200 dark:border-slate-800 bg-gradient-to-br from-amber-500/10 to-orange-500/10 mb-8">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">You are getting a gift for...</p>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">🎁 {match.display_name}</h1>
            {exchange.exchange_date && (
              <p className="text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" />
                Gift needed by{" "}
                {new Date(exchange.exchange_date).toLocaleDateString("en-US", {
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

        {/* Wishlist */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <List className="h-5 w-5 text-violet-500 dark:text-violet-400" />
            {match.display_name}&apos;s Wishlist
          </h2>
          <Button
            variant="outline"
            onClick={handleNudge}
            disabled={nudging}
            aria-label={`Ask ${match.display_name} for more wishlist ideas anonymously`}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {nudging ? "Sending..." : "Ask for more ideas"}
          </Button>
        </div>

        {wishlistItems.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
            <CardContent className="py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4">
                <Gift className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No wishlist items yet</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {match.display_name} has not added any items to their wishlist yet.
                <br />
                Check back later or surprise them with something thoughtful!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {wishlistItems.map((item) => (
              <Card key={item.id} className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {item.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="h-8 w-8 text-slate-400 dark:text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3">
                        {item.price && (
                          <span className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            <DollarSign className="h-3 w-3" />
                            {parseFloat(item.price).toFixed(2)}
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
            ))}
          </div>
        )}

        <p className="text-center text-sm text-slate-500 mt-8">
          🤫 Remember: Keep your match a secret!
        </p>
      </main>
    </div>
  );
}

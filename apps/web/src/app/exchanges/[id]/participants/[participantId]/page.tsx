"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Clock, List, Lock, Sparkles, UserX, type LucideIcon } from "lucide-react";
import type { ExchangeParticipant, GiftExchange, WishlistAccess } from "@niftygifty/types";
import { useAuth } from "@/contexts/auth-context";
import { giftExchangesService, exchangeParticipantsService, wishlistAccessRequestsService } from "@/services";
import { humanizeError } from "@/lib/error-message";
import { signInUrlForCurrentPage } from "@/lib/sign-in-redirect";
import { AppHeader } from "@/components/layout";
import { MatchWishlist } from "@/components/exchanges/match-wishlist";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ClosedAccess = Exclude<WishlistAccess, "own" | "match" | "approved">;

const CLOSED_COPY: Record<ClosedAccess, { icon: LucideIcon; title: (name: string) => string; body: (name: string) => string }> = {
  none: {
    icon: Lock,
    title: (name) => `${name}'s wishlist is private`,
    body: (name) => `Ask to see it. ${name} can say yes or no, and won't know it was you.`,
  },
  pending: {
    icon: Clock,
    title: () => "Request sent",
    body: (name) => `We'll let you know when ${name} answers.`,
  },
  denied: {
    icon: Lock,
    title: (name) => `${name} is keeping their wishlist private`,
    body: () => "They said no to sharing it.",
  },
  unavailable: {
    icon: UserX,
    title: (name) => `${name} hasn't joined yet`,
    body: () => "Once they join, you can ask to see their wishlist.",
  },
};

export default function ExchangeParticipantPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const { id: slug, participantId } = use(params);
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const [exchange, setExchange] = useState<GiftExchange | null>(null);
  const [participant, setParticipant] = useState<ExchangeParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);

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
        setParticipant(await exchangeParticipantsService.getById(exchangeData.id, Number(participantId)));
      } catch {
        // Shown below as not found.
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, slug, participantId]);

  const handleAsk = async () => {
    if (!exchange || !participant) return;
    setAsking(true);
    try {
      await wishlistAccessRequestsService.create(exchange.id, participant.id);
      setParticipant({ ...participant, wishlist_access: "pending" });
      toast.success(`Asked ${participant.display_name}`);
    } catch (err: unknown) {
      toast.error(humanizeError(err, "Could not send the request"));
    } finally {
      setAsking(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!exchange || !participant || !exchange.my_participant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Only people taking part in this exchange can see each other&apos;s wishlists.
          </p>
          <Link href={exchange ? `/exchanges/${slug}` : "/exchanges"}>
            <Button className="mt-4">Back to {exchange ? exchange.name : "Exchanges"}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const name = participant.display_name;
  const access: WishlistAccess =
    participant.id === exchange.my_participant.id ? "own" : participant.wishlist_access ?? "unavailable";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href={`/exchanges/${slug}`}
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to {exchange.name}
        </Link>

        <h1 className="break-words text-3xl font-bold text-slate-900 dark:text-white mb-6">{name}</h1>

        {access === "match" && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
            You&apos;re getting a gift for {name}
          </div>
        )}

        {access === "own" ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
            <CardContent className="py-10 text-center">
              <p className="text-lg font-semibold text-slate-900 dark:text-white mb-4">This is you.</p>
              <Button asChild variant="outline">
                <Link href={`/exchanges/${slug}/my-wishlist`}>
                  <List className="h-4 w-4 mr-2" />
                  Edit your wishlist
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : access === "match" || access === "approved" ? (
          <MatchWishlist
            exchangeId={exchange.id}
            matchName={name}
            items={participant.wishlist_items ?? []}
            canNudge={access === "match" && exchange.capabilities.nudge_match}
          />
        ) : (
          <ClosedWishlist access={access} name={name} asking={asking} onAsk={handleAsk} />
        )}
      </main>
    </div>
  );
}

function ClosedWishlist({
  access,
  name,
  asking,
  onAsk,
}: {
  access: ClosedAccess;
  name: string;
  asking: boolean;
  onAsk: () => void;
}) {
  const copy = CLOSED_COPY[access];
  const Icon = copy.icon;

  return (
    <Card data-testid="closed-wishlist" className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <CardContent className="py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4">
          <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="break-words text-lg font-semibold text-slate-900 dark:text-white mb-2">{copy.title(name)}</p>
        <p className="break-words text-slate-600 dark:text-slate-400">{copy.body(name)}</p>
        {access === "none" && (
          <Button
            onClick={onAsk}
            disabled={asking}
            className="mt-6 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
          >
            {asking ? "Sending..." : "Ask to see their wishlist"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { giftExchangesService } from "@/services";
import { useWorkspaceData } from "@/hooks";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Gift, Calendar, Users, ChevronRight, Crown } from "lucide-react";
import type { GiftExchange } from "@niftygifty/types";

function getStatusColor(status: string) {
  switch (status) {
    case "draft":
      return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/50";
    case "inviting":
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50";
    case "active":
      return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50";
    case "completed":
      return "bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/50";
    default:
      return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/50";
  }
}

function ExchangeCard({ exchange }: { exchange: GiftExchange }) {
  const date = exchange.exchange_date ? new Date(exchange.exchange_date) : null;
  const formattedDate = date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Link href={`/exchanges/${exchange.id}`}>
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl">
              🎁
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{exchange.name}</h3>
                {exchange.is_owner && (
                  <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                {formattedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formattedDate}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {exchange.accepted_count}/{exchange.participant_count}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor(exchange.status)}>
                {exchange.status}
              </Badge>
              <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ExchangesPage() {
  const {
    data: exchanges,
    isLoading,
    user,
    signOut,
  } = useWorkspaceData<GiftExchange[]>({
    fetcher: () => giftExchangesService.getAll(),
    initialData: [],
  });

  const myExchanges = exchanges.filter((e) => e.is_owner);
  const participatingIn = exchanges.filter((e) => !e.is_owner);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Gift Exchanges</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Create and manage Secret Santa-style gift exchanges
            </p>
          </div>
          <Link href="/exchanges/new">
            <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600">
              <Plus className="h-4 w-4 mr-2" />
              New Exchange
            </Button>
          </Link>
        </div>

        {exchanges.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
            <Gift className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Exchanges Yet</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
              Create a gift exchange to organize a Secret Santa or gift swap with friends and family.
            </p>
            <Link href="/exchanges/new">
              <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Exchange
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {myExchanges.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  My Exchanges
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myExchanges.map((exchange) => (
                    <ExchangeCard key={exchange.id} exchange={exchange} />
                  ))}
                </div>
              </div>
            )}

            {participatingIn.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                  Participating In
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {participatingIn.map((exchange) => (
                    <ExchangeCard key={exchange.id} exchange={exchange} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

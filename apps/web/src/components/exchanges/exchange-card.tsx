"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, ChevronRight, Crown } from "lucide-react";
import { ExchangeStatusBadge } from "./exchange-status-badge";
import type { GiftExchange } from "@niftygifty/types";

interface ExchangeCardProps {
  exchange: GiftExchange;
}

export function ExchangeCard({ exchange }: ExchangeCardProps) {
  const date = exchange.exchange_date ? new Date(exchange.exchange_date) : null;
  const formattedDate = date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Link href={`/exchanges/${exchange.slug}`}>
      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-800/50 hover:border-violet-500/50 transition-all cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl shrink-0">
              🎁
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white truncate">{exchange.name}</h3>
                {exchange.is_owner && (
                  <Crown className="h-4 w-4 text-amber-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
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
              <ExchangeStatusBadge status={exchange.status} />
              <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-violet-400 transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

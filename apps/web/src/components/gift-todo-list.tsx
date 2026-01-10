"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { giftsService } from "@/services";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Package, Truck, MapPin, Lightbulb } from "lucide-react";
import type { Gift } from "@niftygifty/types";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  Idea: { icon: <Lightbulb className="h-3 w-3" />, color: "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30" },
  Purchased: { icon: <Package className="h-3 w-3" />, color: "bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30" },
  "In Transit": { icon: <Truck className="h-3 w-3" />, color: "bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30" },
  Delivered: { icon: <MapPin className="h-3 w-3" />, color: "bg-green-500/20 text-green-600 dark:text-green-300 border-green-500/30" },
};

export function GiftTodoList() {
  const { currentWorkspace } = useWorkspace();
  const [gifts, setGifts] = useState<Gift[]>([]);

  const loadGifts = useCallback(async () => {
    if (!currentWorkspace) return;

    try {
      const allGifts = await giftsService.getAll();
      // Filter out completed gifts (status "Done")
      const pendingGifts = allGifts.filter((g) => g.gift_status.name !== "Done");
      setGifts(pendingGifts);
    } catch {
      // Silently fail - dashboard still works
    }
  }, [currentWorkspace]);

  // Re-fetch when workspace changes
  useEffect(() => {
    loadGifts();
  }, [loadGifts]);

  if (gifts.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        <CardContent className="p-4">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
            To Do
          </h2>
          <p className="text-sm text-slate-500">All caught up! 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <CardContent className="p-4">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          To Do
          <Badge variant="secondary" className="ml-auto bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs">
            {gifts.length}
          </Badge>
        </h2>
        <ul className="space-y-2">
          {gifts.slice(0, 8).map((gift) => {
            const statusConfig = STATUS_CONFIG[gift.gift_status.name] || STATUS_CONFIG.Idea;
            const recipientNames = gift.recipients.map((r) => r.name).join(", ");

            return (
              <li key={gift.id}>
                <Link
                  href={`/holidays/${gift.holiday_id}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <Badge variant="outline" className={`shrink-0 ${statusConfig.color}`}>
                    {statusConfig.icon}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                      {gift.name}
                    </p>
                    {recipientNames && (
                      <p className="text-xs text-slate-500 truncate">for {recipientNames}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-600 shrink-0">{gift.holiday.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {gifts.length > 8 && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            +{gifts.length - 8} more
          </p>
        )}
      </CardContent>
    </Card>
  );
}

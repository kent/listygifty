"use client";

import { Badge } from "@/components/ui/badge";
import type { ExchangeStatus } from "@niftygifty/types";

interface ExchangeStatusBadgeProps {
  status: ExchangeStatus;
}

const statusStyles: Record<ExchangeStatus, string> = {
  draft: "bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/50",
  inviting: "bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500/50",
  active: "bg-green-500/20 text-green-800 dark:text-green-400 border-green-500/50",
  completed: "bg-violet-500/20 text-violet-700 dark:text-violet-400 border-violet-500/50",
};

const statusLabels: Record<ExchangeStatus, string> = {
  draft: "Draft",
  inviting: "Inviting",
  active: "Active",
  completed: "Completed",
};

export function ExchangeStatusBadge({ status }: ExchangeStatusBadgeProps) {
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

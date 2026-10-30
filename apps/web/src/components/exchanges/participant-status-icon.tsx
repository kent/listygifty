"use client";

import { Check, X, Clock } from "lucide-react";
import type { ParticipantStatus } from "@niftygifty/types";

interface ParticipantStatusIconProps {
  status: ParticipantStatus;
  className?: string;
}

export function ParticipantStatusIcon({ status, className }: ParticipantStatusIconProps) {
  switch (status) {
    case "accepted":
      return <Check className={`h-4 w-4 text-green-600 dark:text-green-400 ${className || ""}`} />;
    case "declined":
      return <X className={`h-4 w-4 text-red-600 dark:text-red-400 ${className || ""}`} />;
    default:
      return <Clock className={`h-4 w-4 text-amber-800 dark:text-amber-400 ${className || ""}`} />;
  }
}

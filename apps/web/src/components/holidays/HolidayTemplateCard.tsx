"use client";

import type { Holiday } from "@niftygifty/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Gift,
  Flame,
  Egg,
  Heart,
  HeartHandshake,
  User,
  Cake,
  CalendarHeart,
  Utensils,
  PartyPopper,
  GraduationCap,
  Calendar,
  Sparkles,
  Moon,
  Star,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  gift: Gift,
  candle: Sparkles, // Using Sparkles as a substitute for candle
  flame: Flame,
  egg: Egg,
  heart: Heart,
  "heart-handshake": HeartHandshake,
  user: User,
  cake: Cake,
  "calendar-heart": CalendarHeart,
  utensils: Utensils,
  "party-popper": PartyPopper,
  "graduation-cap": GraduationCap,
  moon: Moon,
  star: Star,
};

interface HolidayTemplateCardProps {
  holiday: Holiday;
  onStartPlanning: (holiday: Holiday) => void;
  isLoading?: boolean;
}

export function HolidayTemplateCard({
  holiday,
  onStartPlanning,
  isLoading,
}: HolidayTemplateCardProps) {
  const IconComponent = ICON_MAP[holiday.icon || ""] || Calendar;
  const currentYear = new Date().getFullYear();

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 group-hover:from-violet-500/30 group-hover:to-fuchsia-500/30 transition-colors">
              <IconComponent className="h-5 w-5 text-violet-700 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{holiday.name}</h3>
              <p className="text-xs text-muted-foreground">Gift-giving occasion</p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => onStartPlanning(holiday)}
          disabled={isLoading}
          size="sm"
          className="w-full mt-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0"
        >
          {isLoading ? "Creating..." : `Plan ${holiday.name} ${currentYear}`}
        </Button>
      </CardContent>
    </Card>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { holidaysService } from "@/services";
import { useWorkspaceData } from "@/hooks";
import { AppHeader } from "@/components/layout";
import { HolidaysNav, type HolidaysSection } from "@/components/holidays";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, ChevronRight, Plus, Pencil, Check, Archive, RotateCcw, Users, MapPin, Sparkles, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Holiday } from "@niftygifty/types";
import {
  detectUserRegion,
  getRegionDisplayName,
  getUpcomingHolidaysForRegion,
  getPersonalOccasions,
  formatDaysUntil,
  type UpcomingHoliday,
} from "@/lib/regional-holidays";

function getHolidayIcon(icon?: string | null) {
  const icons: Record<string, string> = {
    christmas: "🎄",
    gift: "🎁",
    candle: "🕎",
    flame: "🪔",
    egg: "🐰",
    heart: "💝",
    "heart-handshake": "💐",
    user: "👔",
    cake: "🎂",
    "calendar-heart": "💍",
    utensils: "🦃",
    "party-popper": "🎉",
    "graduation-cap": "🎓",
    hanukkah: "🕎",
    diwali: "🪔",
    easter: "🐰",
    birthday: "🎂",
    thanksgiving: "🦃",
    valentines: "💝",
    mothers_day: "💐",
    fathers_day: "👔",
    moon: "🌙",
    star: "⭐",
  };
  return icon ? icons[icon] || "🎁" : "🎁";
}

function HolidayCard({
  holiday,
  onToggleComplete,
  onToggleArchive,
}: {
  holiday: Holiday;
  onToggleComplete?: (holiday: Holiday) => void;
  onToggleArchive?: (holiday: Holiday) => void;
}) {
  const icon = getHolidayIcon(holiday.icon);
  const date = holiday.date ? new Date(holiday.date) : null;
  const formattedDate = date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const isShared = !holiday.is_owner;

  return (
    <div className="relative group">
      <Link href={`/holidays/${holiday.id}`}>
        <Card className={`border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all cursor-pointer ${isShared ? "border-l-2 border-l-cyan-500/50" : ""}`}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${isShared ? "bg-gradient-to-br from-cyan-500/20 to-violet-500/20" : "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20"}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{holiday.name}</h3>
                {isShared && (
                  <Badge variant="outline" className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/50 gap-1 shrink-0">
                    <Users className="h-3 w-3" />
                    Shared
                  </Badge>
                )}
              </div>
              {formattedDate && <p className="text-sm text-slate-500 dark:text-slate-400">{formattedDate}</p>}
            </div>
            <div className="w-5" /> {/* Spacer for arrow/button */}
          </CardContent>
        </Card>
      </Link>
      
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {onToggleArchive && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleArchive(holiday);
            }}
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}
        {onToggleComplete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleComplete(holiday);
            }}
            title={holiday.completed ? "Mark as active" : "Mark as complete"}
          >
            {holiday.completed ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        )}
        <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors pointer-events-none" />
      </div>
    </div>
  );
}

function TemplateCard({
  holiday,
  onSelect,
}: {
  holiday: Holiday;
  onSelect: (holiday: Holiday) => void;
}) {
  const icon = getHolidayIcon(holiday.icon);

  return (
    <button
      onClick={() => onSelect(holiday)}
      className="w-full text-left"
    >
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all group cursor-pointer">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{holiday.name}</h3>
            <p className="text-sm text-slate-500">Click to add</p>
          </div>
          <Plus className="h-5 w-5 text-slate-400 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
        </CardContent>
      </Card>
    </button>
  );
}

function CreateHolidayForm({
  template,
  onSubmit,
  onCancel,
}: {
  template: Holiday | null;
  onSubmit: (name: string, date: string, icon?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name || "");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), date, template?.icon || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const icon = getHolidayIcon(template?.icon);

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm max-w-md">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl">
              {icon}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {template ? `Add ${template.name}` : "Create Custom Gift List"}
            </h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gift list name"
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className="text-slate-700 dark:text-slate-300">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="flex-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !date}
              className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
            >
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


function QuickHolidayCard({
  holiday,
  onClick,
  isCreating,
  featured = false,
}: {
  holiday: UpcomingHoliday;
  onClick: () => void;
  isCreating: boolean;
  featured?: boolean;
}) {
  const icon = getHolidayIcon(holiday.icon);
  const daysText = formatDaysUntil(holiday.daysUntil);
  const isUrgent = holiday.daysUntil <= 14;

  if (featured) {
    return (
      <button
        onClick={onClick}
        disabled={isCreating}
        className="w-full text-left"
      >
        <Card className="border-violet-500/30 dark:border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent dark:from-violet-500/20 dark:via-fuchsia-500/10 backdrop-blur-sm hover:border-violet-500/50 transition-all group cursor-pointer overflow-hidden relative">
          <div className="absolute top-2 right-2">
            <Badge className="bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30 text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              Coming up
            </Badge>
          </div>
          <CardContent className="p-5 pt-10">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-3xl shrink-0 shadow-lg shadow-violet-500/10">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">
                  {holiday.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{holiday.displayDate}</p>
                <p className={`text-xs mt-1 ${isUrgent ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-500"}`}>
                  {daysText}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white shrink-0 group-hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25">
                <Plus className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={isCreating}
      className="w-full text-left"
    >
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all group cursor-pointer">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-xl shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate text-sm sm:text-base">
              {holiday.name}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500">{holiday.displayDate}</p>
              {isUrgent && (
                <span className="text-xs text-amber-600 dark:text-amber-400">({daysText})</span>
              )}
            </div>
          </div>
          <Plus className="h-4 w-4 text-slate-400 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors shrink-0" />
        </CardContent>
      </Card>
    </button>
  );
}

function PersonalOccasionCard({
  name,
  icon,
  onClick,
}: {
  name: string;
  icon: string;
  onClick: () => void;
}) {
  const iconEmoji = getHolidayIcon(icon);

  return (
    <button onClick={onClick} className="text-left">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:border-violet-500/50 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-all group">
        <span className="text-lg">{iconEmoji}</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{name}</span>
        <Plus className="h-3 w-3 text-slate-400 group-hover:text-violet-500 ml-auto" />
      </div>
    </button>
  );
}

function EmptyHolidaysState({
  onCreateHoliday,
  onShowCustomForm,
}: {
  onCreateHoliday: (name: string, date: string, icon?: string) => Promise<void>;
  onShowCustomForm: () => void;
}) {
  const [creatingHoliday, setCreatingHoliday] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string>("your region");
  const [upcomingHolidays, setUpcomingHolidays] = useState<UpcomingHoliday[]>([]);
  const personalOccasions = getPersonalOccasions();

  useEffect(() => {
    // Detect region on client side only
    const detectedRegion = detectUserRegion();
    setRegionName(getRegionDisplayName(detectedRegion));
    setUpcomingHolidays(getUpcomingHolidaysForRegion(detectedRegion, 6));
  }, []);

  const handleQuickCreate = async (holiday: UpcomingHoliday) => {
    setCreatingHoliday(holiday.date);
    try {
      await onCreateHoliday(holiday.name, holiday.date, holiday.icon);
    } finally {
      setCreatingHoliday(null);
    }
  };

  const handlePersonalOccasion = () => {
    // For personal occasions, show the custom form
    onShowCustomForm();
  };

  const featuredHoliday = upcomingHolidays[0];
  const otherHolidays = upcomingHolidays.slice(1);

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-sm mb-4">
          <MapPin className="h-3.5 w-3.5" />
          <span>Suggestions for {regionName}</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Start Planning Your Gifts</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Pick an upcoming occasion or create a custom gift list
        </p>
      </div>

      {/* Featured upcoming holiday */}
      {featuredHoliday && (
        <QuickHolidayCard
          holiday={featuredHoliday}
          onClick={() => handleQuickCreate(featuredHoliday)}
          isCreating={creatingHoliday === featuredHoliday.date}
          featured
        />
      )}

      {/* Other upcoming holidays */}
      {otherHolidays.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            More upcoming occasions
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {otherHolidays.map((holiday) => (
              <QuickHolidayCard
                key={`${holiday.name}-${holiday.date}`}
                holiday={holiday}
                onClick={() => handleQuickCreate(holiday)}
                isCreating={creatingHoliday === holiday.date}
              />
            ))}
          </div>
        </div>
      )}

      {/* Personal occasions */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
          <Heart className="h-4 w-4" />
          Personal occasions
        </h3>
        <div className="flex flex-wrap gap-2">
          {personalOccasions.map((occasion) => (
            <PersonalOccasionCard
              key={occasion.name}
              name={occasion.name}
              icon={occasion.icon}
              onClick={handlePersonalOccasion}
            />
          ))}
        </div>
      </div>

      {/* Custom option */}
      <button onClick={onShowCustomForm} className="w-full">
        <Card className="border-slate-300 dark:border-slate-800 border-dashed bg-slate-100/50 dark:bg-slate-900/30 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all group cursor-pointer">
          <CardContent className="p-4 flex items-center justify-center gap-2">
            <Plus className="h-4 w-4 text-slate-500 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              Create Something Else
            </span>
          </CardContent>
        </Card>
      </button>
    </div>
  );
}

function ActiveSection({
  holidays,
  onToggleComplete,
  onToggleArchive,
  onCreateHoliday,
  onShowNewSection,
}: {
  holidays: Holiday[];
  onToggleComplete: (holiday: Holiday) => void;
  onToggleArchive?: (holiday: Holiday) => void;
  onCreateHoliday: (name: string, date: string, icon?: string) => Promise<void>;
  onShowNewSection: () => void;
}) {
  if (holidays.length === 0) {
    return (
      <EmptyHolidaysState
        onCreateHoliday={onCreateHoliday}
        onShowCustomForm={onShowNewSection}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {holidays.map((holiday) => (
        <HolidayCard
          key={holiday.id}
          holiday={holiday}
          onToggleComplete={onToggleComplete}
          onToggleArchive={onToggleArchive}
        />
      ))}
    </div>
  );
}

function PastSection({
  holidays,
  onToggleComplete,
  onToggleArchive,
}: {
  holidays: Holiday[];
  onToggleComplete: (holiday: Holiday) => void;
  onToggleArchive?: (holiday: Holiday) => void;
}) {
  if (holidays.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
        <Archive className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Past Gift Lists</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Gift lists marked as complete will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {holidays.map((holiday) => (
        <HolidayCard
          key={holiday.id}
          holiday={holiday}
          onToggleComplete={onToggleComplete}
          onToggleArchive={onToggleArchive}
        />
      ))}
    </div>
  );
}

function ArchivedSection({
  holidays,
  onToggleArchive,
}: {
  holidays: Holiday[];
  onToggleArchive: (holiday: Holiday) => void;
}) {
  if (holidays.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
        <Archive className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Archived Gift Lists</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Archived gift lists will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {holidays.map((holiday) => (
        <div key={holiday.id} className="relative group">
          <Link href={`/holidays/${holiday.id}`}>
            <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all cursor-pointer opacity-60">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl">
                  {getHolidayIcon(holiday.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{holiday.name}</h3>
                  </div>
                  {holiday.date && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(holiday.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="w-5" />
              </CardContent>
            </Card>
          </Link>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleArchive(holiday);
              }}
              title="Unarchive"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors pointer-events-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewHolidaySection({
  templates,
  onCreateHoliday,
}: {
  templates: Holiday[];
  onCreateHoliday: (name: string, date: string, icon?: string) => Promise<void>;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<Holiday | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [creatingHoliday, setCreatingHoliday] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string>("your region");
  const [upcomingHolidays, setUpcomingHolidays] = useState<UpcomingHoliday[]>([]);
  const personalOccasions = getPersonalOccasions();

  useEffect(() => {
    const detectedRegion = detectUserRegion();
    setRegionName(getRegionDisplayName(detectedRegion));
    setUpcomingHolidays(getUpcomingHolidaysForRegion(detectedRegion, 6));
  }, []);

  const handleSubmit = async (name: string, date: string, icon?: string) => {
    await onCreateHoliday(name, date, icon);
    setSelectedTemplate(null);
    setShowCustomForm(false);
  };

  const handleQuickCreate = async (holiday: UpcomingHoliday) => {
    setCreatingHoliday(holiday.date);
    try {
      await onCreateHoliday(holiday.name, holiday.date, holiday.icon);
    } finally {
      setCreatingHoliday(null);
    }
  };

  if (selectedTemplate || showCustomForm) {
    return (
      <CreateHolidayForm
        template={selectedTemplate}
        onSubmit={handleSubmit}
        onCancel={() => {
          setSelectedTemplate(null);
          setShowCustomForm(false);
        }}
      />
    );
  }

  const featuredHoliday = upcomingHolidays[0];
  const otherHolidays = upcomingHolidays.slice(1, 5);

  return (
    <div className="space-y-8">
      {/* Hero section with regional suggestions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-sm">
            <MapPin className="h-3.5 w-3.5" />
            <span>Suggestions for {regionName}</span>
          </div>
        </div>

        {/* Featured upcoming holiday */}
        {featuredHoliday && (
          <QuickHolidayCard
            holiday={featuredHoliday}
            onClick={() => handleQuickCreate(featuredHoliday)}
            isCreating={creatingHoliday === featuredHoliday.date}
            featured
          />
        )}

        {/* Other upcoming holidays */}
        {otherHolidays.length > 0 && (
          <div className="mt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {otherHolidays.map((holiday) => (
                <QuickHolidayCard
                  key={`${holiday.name}-${holiday.date}`}
                  holiday={holiday}
                  onClick={() => handleQuickCreate(holiday)}
                  isCreating={creatingHoliday === holiday.date}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Personal occasions */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
          <Heart className="h-4 w-4" />
          Personal occasions
        </h3>
        <div className="flex flex-wrap gap-2">
          {personalOccasions.map((occasion) => (
            <PersonalOccasionCard
              key={occasion.name}
              name={occasion.name}
              icon={occasion.icon}
              onClick={() => setShowCustomForm(true)}
            />
          ))}
        </div>
      </div>

      {/* Templates section */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">All Templates</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              holiday={template}
              onSelect={setSelectedTemplate}
            />
          ))}
        </div>
      </div>

      {/* Custom option */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Or Create Your Own</h2>
        <button onClick={() => setShowCustomForm(true)} className="w-full max-w-sm">
          <Card className="border-slate-300 dark:border-slate-800 border-dashed bg-slate-100/50 dark:bg-slate-900/30 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all group cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-slate-400 dark:border-slate-700 group-hover:border-violet-500/50 transition-colors">
                <Pencil className="h-5 w-5 text-slate-500 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  Custom Holiday
                </h3>
                <p className="text-sm text-slate-500">Create your own</p>
              </div>
              <Plus className="h-5 w-5 text-slate-400 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  );
}

interface HolidaysData {
  holidays: Holiday[];
  templates: Holiday[];
}

export default function HolidaysPage() {
  const searchParams = useSearchParams();

  const {
    data,
    setData,
    isLoading,
    error,
    user,
    signOut,
  } = useWorkspaceData<HolidaysData>({
    fetcher: async () => {
      const [holidays, templates] = await Promise.all([
        holidaysService.getAll(),
        holidaysService.getTemplates(),
      ]);
      return { holidays, templates };
    },
    initialData: { holidays: [], templates: [] },
  });

  const { holidays, templates } = data;

  // Initialize section from URL param if present
  const initialSection = (searchParams.get("section") as HolidaysSection) || "active";
  const [activeSection, setActiveSection] = useState<HolidaysSection>(
    ["active", "past", "archived", "new"].includes(initialSection) ? initialSection : "active"
  );


  const handleCreateHoliday = async (name: string, date: string, icon?: string) => {
    const holiday = await holidaysService.create({ name, date, icon });
    setData((prev) => ({ ...prev, holidays: [...prev.holidays, holiday] }));
    setActiveSection("active");
    toast.success(`Created "${holiday.name}"`);
  };

  const handleToggleComplete = async (holiday: Holiday) => {
    try {
      const updated = await holidaysService.update(holiday.id, {
        completed: !holiday.completed,
      });
      setData((prev) => ({
        ...prev,
        holidays: prev.holidays.map((h) => (h.id === holiday.id ? updated : h)),
      }));
      toast.success(
        updated.completed
          ? `Marked "${updated.name}" as complete`
          : `Marked "${updated.name}" as active`
      );
    } catch {
      toast.error("Failed to update gift list");
    }
  };

  const handleToggleArchive = async (holiday: Holiday) => {
    try {
      const updated = await holidaysService.update(holiday.id, {
        archived: !holiday.archived,
      });
      setData((prev) => ({
        ...prev,
        holidays: prev.holidays.map((h) => (h.id === holiday.id ? updated : h)),
      }));
      toast.success(
        updated.archived
          ? `Archived "${updated.name}"`
          : `Unarchived "${updated.name}"`
      );
    } catch {
      toast.error("Failed to update gift list");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeHolidays = holidays.filter((h) => !h.completed && !h.archived);
  const pastHolidays = holidays.filter((h) => h.completed && !h.archived);
  const archivedHolidays = holidays.filter((h) => h.archived);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Gift Lists</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Plan gifts for upcoming occasions or review past ones.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:gap-8">
          <HolidaysNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            activeCounts={{ active: activeHolidays.length, past: pastHolidays.length, archived: archivedHolidays.length }}
          />

          <div className="flex-1 min-w-0">
            {activeSection === "active" && (
              <ActiveSection
                holidays={activeHolidays}
                onToggleComplete={handleToggleComplete}
                onToggleArchive={handleToggleArchive}
                onCreateHoliday={handleCreateHoliday}
                onShowNewSection={() => setActiveSection("new")}
              />
            )}
            {activeSection === "past" && (
              <PastSection
                holidays={pastHolidays}
                onToggleComplete={handleToggleComplete}
                onToggleArchive={handleToggleArchive}
              />
            )}
            {activeSection === "archived" && (
              <ArchivedSection
                holidays={archivedHolidays}
                onToggleArchive={handleToggleArchive}
              />
            )}
            {activeSection === "new" && (
              <NewHolidaySection
                templates={templates}
                onCreateHoliday={handleCreateHoliday}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

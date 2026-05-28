"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { holidaysService, giftsService, peopleService, matchArrangementsService, giftStatusesService, AUTH_ROUTES } from "@/services";
import { AppHeader } from "@/components/layout";
import { MatchWorkspace } from "@/components/match";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import type { Holiday, Gift, Person, MatchArrangement, GiftStatus } from "@niftygifty/types";

function getHolidayIcon(icon?: string | null) {
  const icons: Record<string, string> = {
    christmas: "🎄",
    hanukkah: "🕎",
    diwali: "🪔",
    easter: "🐰",
    birthday: "🎂",
    thanksgiving: "🦃",
    valentines: "💝",
    mothers_day: "💐",
    fathers_day: "👔",
  };
  return icon ? icons[icon] || "🎁" : "🎁";
}

export default function MatchPage() {
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();
  const holidayId = Number(params.holidayId);

  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [statuses, setStatuses] = useState<GiftStatus[]>([]);
  const [arrangement, setArrangement] = useState<MatchArrangement | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !holidayId) return;

    async function loadData() {
      try {
        const [holidayData, giftsData, peopleData, statusesData, arrangementsData] = await Promise.all([
          holidaysService.getById(holidayId),
          giftsService.getAll({ holidayId }),
          peopleService.getAll(),
          giftStatusesService.getAll(),
          matchArrangementsService.getByHoliday(holidayId),
        ]);
        setHoliday(holidayData);
        setGifts(giftsData);
        setPeople(peopleData);
        setStatuses(statusesData);
        setArrangement(arrangementsData[0] || null);
      } catch {
        setError("Failed to load data. Please try again.");
      } finally {
        setDataLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, holidayId]);


  const handleArrangementChange = useCallback((updated: MatchArrangement) => {
    setArrangement(updated);
  }, []);

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !holiday) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error || "Gift list not found"}</p>
          <Link href="/holidays">
            <Button>Back to Gift Lists</Button>
          </Link>
        </div>
      </div>
    );
  }

  const icon = getHolidayIcon(holiday.icon);
  const formattedDate = holiday.date
    ? new Date(holiday.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href={`/holidays/${holidayId}`}
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {holiday.name}
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-3xl">
              {icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Gift Matching</h1>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>

        <MatchWorkspace
          holidayId={holidayId}
          gifts={gifts}
          people={people}
          statuses={statuses}
          arrangement={arrangement}
          onArrangementChange={handleArrangementChange}
          onGiftsChange={setGifts}
          onPeopleChange={setPeople}
        />
      </main>
    </div>
  );
}

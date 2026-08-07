"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useGiftFilters } from "@/hooks";
import { holidaysService, giftsService, peopleService, giftStatusesService, workspacesService, exportsService, AUTH_ROUTES } from "@/services";
import { captureWebEvent } from "@/lib/analytics";
import { downloadIcsEvent } from "@/lib/calendar-download";
import { AppHeader } from "@/components/layout";
import { GiftFilters } from "@/components/filters";
import { GiftGrid, GiftListSummaryBar, HolidayReports, ImportGiftsDialog } from "@/components/gifts";
import { ShareHolidayDialog } from "@/components/holidays";
import { CursorOverlay } from "@/components/cursors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Gift as GiftIcon, BarChart3, Users, Scale, Archive, RotateCcw, Share2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Holiday, Gift, Person, GiftStatus, HolidayCollaborator, Address, ImportGiftsResult } from "@niftygifty/types";

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

function getCollaboratorName(collab: HolidayCollaborator): string {
  if (collab.first_name || collab.last_name) {
    return [collab.first_name, collab.last_name].filter(Boolean).join(" ");
  }
  if (collab.email.includes("@clerk.user")) {
    return "Anonymous user";
  }
  return collab.email;
}

function getCollaboratorInitials(collab: HolidayCollaborator): string {
  if (collab.first_name) {
    const first = collab.first_name[0];
    const last = collab.last_name?.[0] || "";
    return (first + last).toUpperCase();
  }
  if (!collab.email.includes("@clerk.user")) {
    return collab.email[0].toUpperCase();
  }
  return "?";
}

export default function HolidayDetailPage() {
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();
  const params = useParams();
  const holidayId = Number(params.id);

  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [statuses, setStatuses] = useState<GiftStatus[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [collaborators, setCollaborators] = useState<HolidayCollaborator[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importGiftsOpen, setImportGiftsOpen] = useState(false);

  const showAddresses = Boolean(
    currentWorkspace?.is_admin &&
    currentWorkspace.show_gift_addresses &&
    currentWorkspace.workspace_type === "business"
  );

  const {
    filters,
    filteredGifts,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useGiftFilters(gifts);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !holidayId || !currentWorkspace) return;

    const workspace = currentWorkspace;

    async function loadData() {
      try {
        const promises: Promise<unknown>[] = [
          holidaysService.getById(holidayId),
          holidaysService.getAll(),
          giftsService.getAll({ holidayId }),
          peopleService.getAll(),
          giftStatusesService.getAll(),
          holidaysService.getCollaborators(holidayId),
        ];

        // Load addresses if enabled for business workspaces
        if (workspace.is_admin && workspace.show_gift_addresses && workspace.workspace_type === "business") {
          promises.push(workspacesService.getAddresses(workspace.id));
        }

        const results = await Promise.all(promises);
        const [
          holidayData,
          holidaysData,
          giftsData,
          peopleData,
          statusesData,
          collaboratorsData,
        ] = results as [Holiday, Holiday[], Gift[], Person[], GiftStatus[], HolidayCollaborator[]];

        setHoliday(holidayData);
        setHolidays(holidaysData);
        setGifts(giftsData);
        setPeople(peopleData);
        setStatuses(statusesData);
        setCollaborators(collaboratorsData);

        // Set addresses if loaded (only for business workspaces)
        if (workspace.is_admin && workspace.show_gift_addresses && workspace.workspace_type === "business" && results[6]) {
          setAddresses(results[6] as Address[]);
        } else {
          setAddresses([]);
        }
      } catch {
        setError("Failed to load gift list. Please try again.");
      } finally {
        setDataLoading(false);
        setCollaboratorsLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, holidayId, currentWorkspace]);


  const handleToggleArchive = useCallback(async () => {
    if (!holiday) return;
    try {
      const updated = await holidaysService.update(holidayId, {
        archived: !holiday.archived,
      });
      setHoliday(updated);
      toast.success(
        updated.archived
          ? `Archived "${updated.name}"`
          : `Unarchived "${updated.name}"`
      );
    } catch {
      toast.error("Failed to update gift list");
    }
  }, [holiday, holidayId]);

  const handleExportGifts = useCallback(async (source = "header") => {
    try {
      await exportsService.downloadGiftsCsv(holidayId);
      captureWebEvent("gift_csv_exported", {
        holiday_id: holidayId,
        source,
      });
      toast.success("Gift list exported successfully");
    } catch {
      captureWebEvent("gift_csv_export_failed", {
        holiday_id: holidayId,
        source,
      });
      toast.error("Failed to export gift list");
    }
  }, [holidayId]);

  const handleFulfillmentReportViewed = useCallback(() => {
    captureWebEvent("fulfillment_report_viewed", {
      holiday_id: holidayId,
      workspace_type: currentWorkspace?.workspace_type,
    });
  }, [currentWorkspace?.workspace_type, holidayId]);

  const handleDownloadCalendarEvent = useCallback(() => {
    if (!holiday?.date) {
      toast.error("This gift list needs a date before it can be added to a calendar");
      return;
    }

    downloadIcsEvent({
      date: holiday.date,
      description: "Review gift ideas, purchases, and delivery details in Listy Gifty.",
      filename: `${holiday.name} gift deadline`,
      title: `${holiday.name} gift deadline`,
      uid: `gift-list-${holiday.id}@listygifty.com`,
    });
    captureWebEvent("gift_list_calendar_exported", {
      holiday_id: holiday.id,
    });
  }, [holiday]);

  const handleGiftsImported = useCallback(async (result: ImportGiftsResult) => {
    if (result.created > 0) {
      setGifts((current) => [...result.gifts, ...current]);
      toast.success(`Imported ${result.created} gift${result.created === 1 ? "" : "s"}`);
    }

    if (result.people_created > 0) {
      try {
        const updatedPeople = await peopleService.getAll();
        setPeople(updatedPeople);
      } catch {
        toast.error("Gifts imported, but people refresh failed");
      }
    }
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
  const collaboratorPeers = collaborators.filter((c) => c.role !== "owner");
  const collaboratorJoinCount = Math.max(collaborators.length - 1, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/holidays"
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Gift Lists
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl md:text-3xl shrink-0">
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{holiday.name}</h1>
                  {holiday.collaborator_count > 1 && (
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {holiday.collaborator_count}
                    </Badge>
                  )}
                  {!holiday.is_owner && holiday.role === "collaborator" && (
                    <Badge variant="outline" className="text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600">
                      Shared
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm md:text-base mt-1">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="truncate">{formattedDate}</span>
                </div>
                {/* Collaborators - hidden on mobile, shown on desktop */}
                <div className="hidden md:block mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {collaboratorsLoading ? (
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  ) : collaboratorJoinCount > 0 ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Users className="h-4 w-4" />
                        <span>
                          {collaboratorJoinCount} {collaboratorJoinCount === 1 ? "person" : "people"} joined
                        </span>
                      </div>
                      <div className="flex -space-x-2">
                        {collaboratorPeers.slice(0, 3).map((collab) =>
                          collab.image_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={collab.user_id}
                              src={collab.image_url}
                              alt={getCollaboratorName(collab)}
                              className="h-8 w-8 rounded-full border-2 border-white dark:border-slate-900 object-cover"
                            />
                          ) : (
                            <div
                              key={collab.user_id}
                              className="h-8 w-8 rounded-full bg-violet-500/20 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-semibold text-violet-600 dark:text-violet-200"
                            >
                              {getCollaboratorInitials(collab)}
                            </div>
                          )
                        )}
                        {collaboratorPeers.length > 3 && (
                          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs text-slate-600 dark:text-slate-300">
                            +{collaboratorPeers.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Users className="h-4 w-4" />
                      <span>No collaborators yet — share your link.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Action buttons - full width on mobile */}
            <div className="flex items-center gap-2 md:shrink-0">
              {holiday.is_owner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleArchive}
                  className="gap-1.5 md:gap-2 flex-1 md:flex-none"
                >
                  {holiday.archived ? (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden sm:inline">Unarchive</span>
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      <span className="hidden sm:inline">Archive</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCalendarEvent}
                disabled={!holiday.date}
                className="gap-1.5 md:gap-2 flex-1 md:flex-none"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Calendar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportGiftsOpen(true)}
                className="gap-1.5 md:gap-2 flex-1 md:flex-none"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportGifts("header")}
                className="gap-1.5 md:gap-2 flex-1 md:flex-none"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <ShareHolidayDialog
                holiday={holiday}
                trigger={
                  <Button className="gap-1.5 md:gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0 shadow-lg shadow-violet-500/25 flex-1 md:flex-none" size="sm">
                    <Share2 className="h-4 w-4 md:h-5 md:w-5" />
                    Share
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {statuses.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
            <GiftIcon className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Gift Statuses</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Create gift statuses (e.g., Idea, Ordered, Delivered) to start tracking gifts.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="gifts" className="w-full">
            <TabsList className="mb-6 w-full md:w-auto">
              <TabsTrigger value="gifts" className="gap-1.5 md:gap-2 flex-1 md:flex-none">
                <GiftIcon className="h-4 w-4" />
                <span>Gifts</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1.5 md:gap-2 flex-1 md:flex-none hidden md:inline-flex">
                <BarChart3 className="h-4 w-4" />
                <span>Reports</span>
              </TabsTrigger>
              <Link href={`/match/${holidayId}`} className="flex-1 md:flex-none">
                <button
                  className="inline-flex h-[calc(100%-1px)] w-full items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] text-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground focus-visible:ring-[3px] focus-visible:outline-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                  <Scale className="h-4 w-4" />
                  <span>Match</span>
                </button>
              </Link>
            </TabsList>
            <TabsContent value="gifts" className="space-y-4">
              <GiftListSummaryBar
                gifts={gifts}
                filteredGifts={filteredGifts}
                statuses={statuses}
                holidayDate={holiday.date}
                hasActiveFilters={hasActiveFilters}
              />
              <GiftFilters
                filters={filters}
                statuses={statuses}
                people={people}
                onSearchChange={(v) => updateFilter("search", v)}
                onStatusChange={(ids) => updateFilter("statusIds", ids)}
                onRecipientChange={(ids) => updateFilter("recipientIds", ids)}
                onGiverChange={(ids) => updateFilter("giverIds", ids)}
                onCostRangeChange={(r) => updateFilter("costRange", r)}
                onClear={clearFilters}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
                totalCount={gifts.length}
                filteredCount={filteredGifts.length}
              />
              <GiftGrid
                gifts={filteredGifts}
                allGifts={gifts}
                people={people}
                statuses={statuses}
                holidays={holidays}
                addresses={addresses}
                showAddresses={showAddresses}
                defaultHolidayId={holidayId}
                defaultStatusId={statuses[0]?.id}
                onGiftsChange={setGifts}
                onPeopleChange={setPeople}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
              />
            </TabsContent>
            <TabsContent value="reports">
              <HolidayReports
                gifts={gifts}
                people={people}
                statuses={statuses}
                showAddresses={showAddresses}
                onExportGifts={handleExportGifts}
                onFulfillmentViewed={handleFulfillmentReportViewed}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <CursorOverlay holidayId={holidayId} />
      <ImportGiftsDialog
        holidayId={holidayId}
        open={importGiftsOpen}
        onOpenChange={setImportGiftsOpen}
        onImported={handleGiftsImported}
      />
    </div>
  );
}

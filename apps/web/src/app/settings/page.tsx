"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { giftStatusesService, AUTH_ROUTES } from "@/services";
import { AppHeader } from "@/components/layout";
import {
  GiftStatusSection,
  ProfileSection,
  BillingSection,
  NotificationsSection,
  AppearanceSection,
  WorkspaceSection,
  TeamSection,
  CompanySection,
  ApiKeysSection,
  SettingsNav,
  type SettingsSection,
} from "@/components/settings";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings as SettingsIcon } from "lucide-react";
import type { GiftStatus } from "@niftygifty/types";

const VALID_SECTIONS: SettingsSection[] = ["profile", "workspace", "team", "company", "notifications", "appearance", "statuses", "api-keys", "billing"];

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [statuses, setStatuses] = useState<GiftStatus[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle tab URL parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && VALID_SECTIONS.includes(tab as SettingsSection)) {
      setActiveSection(tab as SettingsSection);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        const data = await giftStatusesService.getAll();
        setStatuses(data);
      } catch {
        setError("Failed to load settings. Please try again.");
      } finally {
        setDataLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated]);


  const handleAddStatus = useCallback(async (name: string) => {
    const nextPosition = statuses.length > 0
      ? Math.max(...statuses.map((s) => s.position)) + 1
      : 1;
    const status = await giftStatusesService.create({ name, position: nextPosition });
    setStatuses((prev) => [...prev, status]);
    toast.success(`Created "${status.name}" status`);
  }, [statuses]);

  const handleDeleteStatus = useCallback(async (status: GiftStatus) => {
    await giftStatusesService.delete(status.id);
    setStatuses((prev) => prev.filter((s) => s.id !== status.id));
    toast.success(`Deleted "${status.name}" status`);
  }, []);

  const handleReorderStatus = useCallback(async (statusId: number, newPosition: number) => {
    const status = await giftStatusesService.update(statusId, { position: newPosition });
    setStatuses((prev) =>
      prev.map((s) => (s.id === statusId ? status : s)).sort((a, b) => a.position - b.position)
    );
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
            <SettingsIcon className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-fuchsia-500/5 dark:from-fuchsia-900/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/5 via-transparent to-transparent" />
      </div>

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
              <SettingsIcon className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Customize Listy Gifty to fit your workflow
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          <SettingsNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          <div className="flex-1 max-w-2xl pl-4">
            {activeSection === "profile" && (
              <ProfileSection user={user} />
            )}
            {activeSection === "workspace" && (
              <WorkspaceSection />
            )}
            {activeSection === "team" && (
              <TeamSection />
            )}
            {activeSection === "company" && (
              <CompanySection />
            )}
            {activeSection === "notifications" && (
              <NotificationsSection />
            )}
            {activeSection === "appearance" && (
              <AppearanceSection />
            )}
            {activeSection === "statuses" && (
              <GiftStatusSection
                statuses={statuses}
                onAdd={handleAddStatus}
                onDelete={handleDeleteStatus}
                onReorder={handleReorderStatus}
              />
            )}
            {activeSection === "api-keys" && (
              <ApiKeysSection />
            )}
            {activeSection === "billing" && (
              <BillingSection />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

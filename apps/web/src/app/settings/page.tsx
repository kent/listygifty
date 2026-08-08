"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AUTH_ROUTES } from "@/services";
import { AppHeader } from "@/components/layout";
import {
  ProfileSection,
  BillingSection,
  NotificationsSection,
  AppearanceSection,
  WorkspaceSection,
  TeamSection,
  CompanySection,
  ApiKeysSection,
  IntegrationsSection,
  McpOAuthUrlCard,
  SettingsNav,
  type SettingsSection,
} from "@/components/settings";
import { Settings as SettingsIcon } from "lucide-react";

const VALID_SECTIONS: SettingsSection[] = ["profile", "workspace", "team", "company", "notifications", "appearance", "api-keys", "integrations", "billing"];

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");

  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    if (initialTab && VALID_SECTIONS.includes(initialTab as SettingsSection)) {
      return initialTab as SettingsSection;
    }
    return "profile";
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [authLoading, isAuthenticated, router]);

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
        <div className="mb-6">
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

        <div className="mb-8 max-w-5xl">
          <McpOAuthUrlCard />
        </div>

        {/* Main Content */}
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <SettingsNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          <div className="flex-1 max-w-2xl md:pl-4">
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
            {activeSection === "api-keys" && (
              <ApiKeysSection />
            )}
            {activeSection === "integrations" && (
              <IntegrationsSection onOpenApiKeys={() => setActiveSection("api-keys")} />
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

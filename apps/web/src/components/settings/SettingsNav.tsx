"use client";

import { Tags, User, CreditCard, ChevronRight, Bell, Palette, Building2, Users, Code2, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/workspace-context";

export type SettingsSection = "profile" | "notifications" | "appearance" | "statuses" | "billing" | "workspace" | "team" | "company" | "api-keys" | "integrations";

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

type NavItem = {
  id: SettingsSection;
  label: string;
  icon: typeof User;
  disabled?: boolean;
  color: string;
  businessOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: "profile", label: "Profile", icon: User, color: "violet" },
  { id: "workspace", label: "Workspace", icon: Building2, color: "violet" },
  { id: "team", label: "Team", icon: Users, color: "violet" },
  { id: "company", label: "Company", icon: Building2, color: "violet", businessOnly: true },
  { id: "notifications", label: "Notifications", icon: Bell, color: "violet" },
  { id: "appearance", label: "Appearance", icon: Palette, color: "violet" },
  { id: "statuses", label: "Gift Statuses", icon: Tags, color: "violet" },
  { id: "api-keys", label: "API Keys", icon: Code2, color: "violet" },
  { id: "integrations", label: "AI Integrations", icon: Plug, color: "cyan" },
  { id: "billing", label: "Billing", icon: CreditCard, disabled: true, color: "amber" },
];

const colorMap = {
  violet: "from-violet-500 to-fuchsia-500 text-violet-300 shadow-violet-500/20",
  amber: "from-amber-500 to-orange-500 text-amber-300 shadow-amber-500/20",
  cyan: "from-cyan-500 to-blue-500 text-cyan-300 shadow-cyan-500/20",
};

export function SettingsNav({ activeSection, onSectionChange }: SettingsNavProps) {
  const { currentWorkspace } = useWorkspace();
  const isBusiness = currentWorkspace?.workspace_type === "business";

  // Filter out business-only items for personal workspaces
  const visibleItems = NAV_ITEMS.filter(item => !item.businessOnly || isBusiness);

  return (
    <nav className="w-full md:w-64 shrink-0">
      <div className="md:sticky md:top-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl p-2 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-1">
            {visibleItems.map(({ id, label, icon: Icon, disabled, color }) => {
              const isActive = activeSection === id;
              const colors = colorMap[color as keyof typeof colorMap];

              return (
                <li key={id}>
                  <button
                    onClick={() => !disabled && onSectionChange(id)}
                    disabled={disabled}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left group",
                      isActive
                        ? `bg-gradient-to-r ${colors} shadow-lg`
                        : disabled
                          ? "text-slate-400 dark:text-slate-600 cursor-not-allowed"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-white/20"
                        : disabled
                          ? "bg-slate-100 dark:bg-slate-800/30"
                          : "bg-slate-100 dark:bg-slate-800/50 group-hover:bg-slate-200 dark:group-hover:bg-slate-700/50"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-white" : disabled ? "text-slate-400 dark:text-slate-600" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"
                      )} />
                    </div>
                    <span className={cn(
                      "flex-1 transition-colors",
                      isActive && "text-white"
                    )}>{label}</span>
                    {disabled ? (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                        Soon
                      </span>
                    ) : (
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-all duration-200",
                        isActive
                          ? "text-white/70 translate-x-0 opacity-100"
                          : "text-slate-400 dark:text-slate-600 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      )} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}

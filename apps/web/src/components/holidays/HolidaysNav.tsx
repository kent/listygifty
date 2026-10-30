"use client";

import { Sparkles, Clock, Plus, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export type HolidaysSection = "active" | "past" | "archived" | "new";

interface HolidaysNavProps {
  activeSection: HolidaysSection;
  onSectionChange: (section: HolidaysSection) => void;
  activeCounts?: { active: number; past: number; archived: number };
}

const NAV_ITEMS: { id: HolidaysSection; label: string; icon: typeof Sparkles }[] = [
  { id: "active", label: "Active", icon: Sparkles },
  { id: "past", label: "Past", icon: Clock },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "new", label: "New", icon: Plus },
];

export function HolidaysNav({ activeSection, onSectionChange, activeCounts }: HolidaysNavProps) {
  return (
    <nav className="flex overflow-x-auto md:flex-col md:w-56 md:shrink-0 gap-1 pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
      <ul className="flex md:flex-col gap-1 md:space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const count = activeCounts && id !== "new"
            ? (id === "active" ? activeCounts.active : id === "past" ? activeCounts.past : activeCounts.archived)
            : null;
          return (
            <li key={id} className="shrink-0">
              <button
                onClick={() => onSectionChange(id)}
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  activeSection === id
                    ? "bg-violet-500/20 text-violet-600 dark:text-violet-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {count !== null && (
                  <span className="text-xs text-slate-600 dark:text-slate-500 md:ml-auto">{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}


"use client";

import { Users, Star, Clock, Heart, Plus, Share2, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

export type PeopleSection =
  | "all"
  | "needs-gifts"
  | "favourites"
  | "recent"
  | "family"
  | "shared"
  | "new";

interface PeopleNavProps {
  activeSection: PeopleSection;
  onSectionChange: (section: PeopleSection) => void;
  counts?: {
    all: number;
    needsGifts: number;
    favourites: number;
    recent: number;
    family: number;
    shared: number;
  };
}

const NAV_ITEMS: { id: PeopleSection; label: string; icon: typeof Users }[] = [
  { id: "all", label: "All", icon: Users },
  { id: "needs-gifts", label: "Needs Gifts", icon: Gift },
  { id: "favourites", label: "Favourites", icon: Star },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "family", label: "Family", icon: Heart },
  { id: "shared", label: "Shared", icon: Share2 },
  { id: "new", label: "New", icon: Plus },
];

export function PeopleNav({ activeSection, onSectionChange, counts }: PeopleNavProps) {
  return (
    <nav className="flex overflow-x-auto md:flex-col md:w-56 md:shrink-0 gap-1 pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
      <ul className="flex md:flex-col gap-1 md:space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const count =
            counts && id !== "new"
              ? counts[id === "needs-gifts" ? "needsGifts" : id]
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
                  <span className="text-xs text-slate-500 md:ml-auto">{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

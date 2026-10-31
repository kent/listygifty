"use client";

import { RELATIONSHIP_CATEGORIES } from "@niftygifty/types";
import { useWorkspace } from "@/contexts/workspace-context";
import { relationshipCategoriesFor } from "@/lib/relationship-categories";
import { cn } from "@/lib/utils";

export type RelationshipFilterValue = typeof RELATIONSHIP_CATEGORIES[number] | "all" | "other";

interface RelationshipFilterProps {
  value: RelationshipFilterValue;
  onChange: (value: RelationshipFilterValue) => void;
}

export function RelationshipFilter({ value, onChange }: RelationshipFilterProps) {
  const { currentWorkspace } = useWorkspace();
  const options: { value: RelationshipFilterValue; label: string }[] = [
    { value: "all", label: "All" },
    ...relationshipCategoriesFor(currentWorkspace?.workspace_type, value).map((cat) => ({
      value: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
    })),
    { value: "other", label: "Other" },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            value === option.value
              ? "bg-violet-500/20 text-violet-600 dark:text-violet-300 border border-violet-500/50"
              : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-600"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}


"use client";

import { useState } from "react";
import type { GiftStatus } from "@niftygifty/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tags, Plus, Trash2, GripVertical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GiftStatusSectionProps {
  statuses: GiftStatus[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (status: GiftStatus) => Promise<void>;
  onReorder: (statusId: number, newPosition: number) => Promise<void>;
}

function AddStatusForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsAdding(true);
    try {
      await onAdd(name.trim());
      setName("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="group relative rounded-2xl border border-dashed border-slate-300 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/20 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-violet-500/30 hover:bg-slate-50 dark:hover:bg-slate-900/30">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="New status name (e.g. Shipped, Wrapped)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 pr-4 transition-all"
            />
          </div>
          <Button
            type="submit"
            disabled={!name.trim() || isAdding}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/25 disabled:shadow-none disabled:opacity-50 shrink-0 transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? "Adding..." : "Add Status"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function StatusItem({
  status,
  onDelete,
  index,
}: {
  status: GiftStatus;
  onDelete: () => void;
  index: number;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="group relative flex items-center gap-4 px-5 py-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all duration-200"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/50 cursor-grab active:cursor-grabbing transition-colors group-hover:bg-slate-300 dark:group-hover:bg-slate-600/50">
        <GripVertical className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-slate-700 dark:text-slate-200 font-medium">{status.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-xs font-mono text-slate-700 dark:text-slate-400">
          #{status.position}
        </span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
            "opacity-0 group-hover:opacity-100",
            "text-slate-600 dark:text-slate-500 hover:text-red-400 hover:bg-red-500/10",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StatusList({
  statuses,
  onDelete,
}: {
  statuses: GiftStatus[];
  onDelete: (status: GiftStatus) => Promise<void>;
}) {
  if (statuses.length === 0) {
    return (
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100/50 dark:from-slate-800/20 via-transparent to-slate-100/50 dark:to-slate-800/20" />
        <div className="relative py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 mb-4">
            <Tags className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium mb-1">No gift statuses yet</p>
          <p className="text-sm text-slate-600 dark:text-slate-500">Add statuses to track your gift progress</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {statuses.map((status, index) => (
        <StatusItem
          key={status.id}
          status={status}
          onDelete={() => onDelete(status)}
          index={index}
        />
      ))}
    </div>
  );
}

export function GiftStatusSection({
  statuses,
  onAdd,
  onDelete,
}: GiftStatusSectionProps) {
  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Tags className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gift Statuses</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Create custom statuses to track your gift progress
            </p>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-600 dark:text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Suggestions:
        </span>
        {["Idea", "Purchased", "Wrapped", "Shipped", "Given"].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onAdd(suggestion)}
            disabled={statuses.some(s => s.name.toLowerCase() === suggestion.toLowerCase())}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:border-violet-500/30 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <AddStatusForm onAdd={onAdd} />
      <StatusList statuses={statuses} onDelete={onDelete} />
    </section>
  );
}

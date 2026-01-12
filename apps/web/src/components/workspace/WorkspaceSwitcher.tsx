"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, User, ChevronDown, Plus, Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher() {
  const {
    currentWorkspace,
    personalWorkspace,
    businessWorkspaces,
    switchWorkspace,
    isLoading,
  } = useWorkspace();
  const [open, setOpen] = useState(false);

  if (isLoading || !currentWorkspace) {
    return (
      <Button
        variant="ghost"
        className="flex items-center gap-2 px-3 py-2 h-auto"
        disabled
      >
        <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <span className="w-20 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
      </Button>
    );
  }

  const Icon =
    currentWorkspace.workspace_type === "business" ? Building2 : User;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-3 py-2 h-auto text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Icon className="h-4 w-4" />
          <span className="max-w-[120px] truncate font-medium">
            {currentWorkspace.name}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
      >
        {/* Personal Workspace */}
        {personalWorkspace && (
          <>
            <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              Personal
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                switchWorkspace(personalWorkspace.id);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                currentWorkspace.id === personalWorkspace.id &&
                  "bg-violet-50 dark:bg-violet-900/20"
              )}
            >
              <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="truncate flex-1">{personalWorkspace.name}</span>
              {currentWorkspace.id === personalWorkspace.id && (
                <Check className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              )}
            </DropdownMenuItem>
          </>
        )}

        {/* Business Workspaces */}
        {businessWorkspaces.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
            <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              Business
            </DropdownMenuLabel>
            {businessWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => {
                  switchWorkspace(workspace.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  currentWorkspace.id === workspace.id &&
                    "bg-violet-50 dark:bg-violet-900/20"
                )}
              >
                <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="truncate flex-1">{workspace.name}</span>
                {currentWorkspace.id === workspace.id && (
                  <Check className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Actions */}
        <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
        <DropdownMenuItem asChild>
          <Link
            href="/settings?tab=workspace"
            className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" />
            Manage Workspaces
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/workspaces/new"
            className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300"
            onClick={() => setOpen(false)}
          >
            <Plus className="h-4 w-4" />
            Create Business Workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

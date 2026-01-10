"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { peopleService, workspacesService } from "@/services";
import { useWorkspaceData } from "@/hooks";
import { useWorkspace } from "@/contexts/workspace-context";
import { AppHeader } from "@/components/layout";
import {
  PeopleNav,
  AllSection,
  FavouritesSection,
  RecentSection,
  FamilySection,
  SharedSection,
  NewPersonModal,
  ImportPeopleDialog,
  type PeopleSection,
} from "@/components/people";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { Person, WorkspaceMember } from "@niftygifty/types";

export default function PeoplePage() {
  const { currentWorkspace } = useWorkspace();
  const {
    data: people,
    setData: setPeople,
    isLoading,
    error,
    user,
    signOut,
    refetch,
  } = useWorkspaceData<Person[]>({
    fetcher: () => peopleService.getAll(),
    initialData: [],
  });

  const [activeSection, setActiveSection] = useState<PeopleSection>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    if (currentWorkspace) {
      workspacesService.getMembers(currentWorkspace.id).then(setWorkspaceMembers).catch(() => {});
    }
  }, [currentWorkspace]);

  const handleAddPerson = useCallback(async (name: string, relationship?: string) => {
    const person = await peopleService.create({ name, relationship });
    setPeople((prev) => [...prev, person]);
    toast.success(`Added ${person.name} to your gift list!`);
  }, [setPeople]);

  const handleSectionChange = (section: PeopleSection) => {
    if (section === "new") {
      setModalOpen(true);
    } else {
      setActiveSection(section);
    }
  };

  const counts = useMemo(() => ({
    all: people.length,
    favourites: people.filter((p) => p.gift_count > 0).length,
    recent: people.length,
    family: people.filter((p) => p.relationship === "family").length,
    shared: people.filter((p) => p.is_shared).length,
  }), [people]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">People</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage everyone on your gift list. Add family, friends, and colleagues.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:gap-8">
          <PeopleNav
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            counts={counts}
          />

          <div className="flex-1 min-w-0">
            {activeSection === "all" && <AllSection people={people} />}
            {activeSection === "favourites" && <FavouritesSection people={people} />}
            {activeSection === "recent" && <RecentSection people={people} />}
            {activeSection === "family" && <FamilySection people={people} />}
            {activeSection === "shared" && <SharedSection people={people} />}
          </div>
        </div>
      </main>

      <NewPersonModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleAddPerson}
      />

      <ImportPeopleDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={refetch}
        workspaceMembers={workspaceMembers}
      />
    </div>
  );
}

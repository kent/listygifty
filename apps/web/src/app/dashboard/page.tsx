"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { holidaysService, peopleService, AUTH_ROUTES } from "@/services";
import { AppHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, ArrowRight, Loader2, Calendar } from "lucide-react";
import { GiftTodoList } from "@/components/gift-todo-list";
import type { Holiday, Person } from "@niftygifty/types";

const HOLIDAY_ICONS: Record<string, string> = {
  Christmas: "🎄",
  Hanukkah: "🕎",
  Diwali: "🪔",
  Easter: "🐣",
  Birthday: "🎂",
  "Mother's Day": "💐",
  "Father's Day": "👔",
  Valentine: "💝",
};

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  const [templates, setTemplates] = useState<Holiday[]>([]);
  const [userHolidays, setUserHolidays] = useState<Holiday[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [creatingHolidayId, setCreatingHolidayId] = useState<number | null>(null);
  const [newPersonName, setNewPersonName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  // Only show active holidays (not completed or archived)
  const activeHolidays = useMemo(
    () => userHolidays.filter((h) => !h.completed && !h.archived),
    [userHolidays]
  );

  const loadData = useCallback(async () => {
    if (!currentWorkspace) return;

    try {
      const [templatesData, holidaysData, peopleData] = await Promise.all([
        holidaysService.getTemplates(),
        holidaysService.getAll(),
        peopleService.getAll(),
      ]);
      setTemplates(templatesData);
      setUserHolidays(holidaysData);
      setPeople(peopleData);
    } catch {
      toast.error("Failed to load data");
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [isLoading, isAuthenticated, router]);

  // Reload data when workspace changes
  useEffect(() => {
    if (isAuthenticated && currentWorkspace) {
      loadData();
    }
  }, [isAuthenticated, currentWorkspace, loadData]);

  const handleStartPlanning = async (template: Holiday) => {
    setCreatingHolidayId(template.id);
    try {
      const currentYear = new Date().getFullYear();
      const newHoliday = await holidaysService.create({
        name: `${template.name} ${currentYear}`,
        date: new Date().toISOString().split("T")[0],
        icon: template.icon || undefined,
      });
      setUserHolidays((prev) => [...prev, newHoliday]);
      toast.success(`Started planning ${template.name} ${currentYear}!`);
    } catch {
      toast.error("Failed to create gift list");
    } finally {
      setCreatingHolidayId(null);
    }
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    
    setAddingPerson(true);
    try {
      const person = await peopleService.create({ name: newPersonName.trim() });
      setPeople((prev) => [...prev, person]);
      setNewPersonName("");
      toast.success(`Added ${person.name}`);
    } catch {
      toast.error("Failed to add person");
    } finally {
      setAddingPerson(false);
    }
  };

  const getIcon = (name: string) => {
    for (const [key, icon] of Object.entries(HOLIDAY_ICONS)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return "🎁";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <AppHeader user={user} onSignOut={signOut} />

      <main className="container max-w-2xl mx-auto px-4 py-8">
        {/* New Gift List Button - Always Prominent */}
        <section className="mb-6">
          <Link href="/holidays?section=new">
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold shadow-lg shadow-violet-500/25 h-14 text-base"
            >
              <Calendar className="mr-2 h-5 w-5" />
              New Gift List
              <Plus className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>

        {/* Active Gift Lists Only */}
        {activeHolidays.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Active Gift Lists</h2>
            <div className="flex flex-wrap gap-2">
              {activeHolidays.map((holiday) => (
                <Link key={holiday.id} href={`/holidays/${holiday.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-violet-500/50 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20"
                  >
                    {getIcon(holiday.name)} {holiday.name}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Gift To Do List */}
        <section className="mb-8">
          <GiftTodoList />
        </section>

        {/* Quick Actions */}
        <div className="space-y-4">
          {/* Start a Gift List */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
            <CardContent className="p-4">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Start a Gift List</h2>
              <div className="flex flex-wrap gap-2">
                {templates.slice(0, 6).map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartPlanning(template)}
                    disabled={creatingHolidayId === template.id}
                    className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span className="mr-1">{getIcon(template.name)}</span>
                    {template.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Add People */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
            <CardContent className="p-4">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Add People</h2>
              <form onSubmit={handleAddPerson} className="flex gap-2 mb-3">
                <Input
                  placeholder="Name"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500"
                />
                <Button
                  type="submit"
                  disabled={!newPersonName.trim() || addingPerson}
                  className="bg-violet-600 hover:bg-violet-500 shrink-0"
                >
                  {addingPerson ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </form>
              {people.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {people.map((person) => (
                    <Link key={person.id} href={`/people/${person.id}`}>
                      <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                        {person.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

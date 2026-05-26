"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { peopleService, giftSuggestionsService, AUTH_ROUTES } from "@/services";
import { AppHeader } from "@/components/layout";
import { GiftSuggestionsTab } from "@/components/gift-suggestions-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  User,
  Gift as GiftIcon,
  Calendar,
  ExternalLink,
  DollarSign,
  Package,
  Heart,
  Sparkles,
  BarChart3,
  UserCog,
  Save,
  Lightbulb,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import type { PersonWithGifts, Gift, Holiday, RelationshipCategory, GiftSuggestion } from "@niftygifty/types";
import { RELATIONSHIP_CATEGORIES } from "@niftygifty/types";
import { cn } from "@/lib/utils";

type NavTab = "received" | "giving" | "holidays" | "suggestions" | "stats" | "about";
type PersonUpdateInput = {
  name?: string;
  age?: number | null;
  gender?: string | null;
  birthday?: string | null;
  milestone_label?: string | null;
  milestone_date?: string | null;
};

function getHolidayIcon(icon?: string | null) {
  const icons: Record<string, string> = {
    christmas: "🎄",
    hanukkah: "🕎",
    diwali: "🪔",
    easter: "🐰",
    birthday: "🎂",
    thanksgiving: "🦃",
    valentines: "💝",
    mothers_day: "💐",
    fathers_day: "👔",
  };
  return icon ? icons[icon] || "🎁" : "🎁";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupGiftsByHolidayDescending(gifts: Gift[]): Map<Holiday, Gift[]> {
  const grouped = new Map<number, { holiday: Holiday; gifts: Gift[] }>();
  
  for (const gift of gifts) {
    const key = gift.holiday_id;
    if (!grouped.has(key)) {
      grouped.set(key, { holiday: gift.holiday, gifts: [] });
    }
    grouped.get(key)!.gifts.push(gift);
  }
  
  // Sort by holiday date descending
  const sorted = Array.from(grouped.values()).sort((a, b) => {
    const dateA = a.holiday.date ? new Date(a.holiday.date).getTime() : 0;
    const dateB = b.holiday.date ? new Date(b.holiday.date).getTime() : 0;
    return dateB - dateA;
  });
  
  return new Map(sorted.map(({ holiday, gifts }) => [holiday, gifts]));
}

function GiftCard({ gift }: { gift: Gift }) {
  const cost = gift.cost ? parseFloat(gift.cost) : null;

  return (
    <div className="group p-4 rounded-lg bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-900 dark:text-white truncate">{gift.name}</h4>
          {gift.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{gift.description}</p>
          )}
        </div>
        {gift.link && (
          <a
            href={gift.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <Badge
          variant="secondary"
          className="bg-slate-200 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-0"
        >
          {gift.gift_status.name}
        </Badge>
        {cost !== null && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {cost.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function HolidayGiftGroup({ holiday, gifts }: { holiday: Holiday; gifts: Gift[] }) {
  const icon = getHolidayIcon(holiday.icon);
  const totalCost = gifts.reduce((sum, g) => sum + (g.cost ? parseFloat(g.cost) : 0), 0);

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <CardTitle className="text-lg text-slate-900 dark:text-white">{holiday.name}</CardTitle>
              {holiday.date && (
                <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  <Calendar className="h-3 w-3" />
                  {formatDate(holiday.date)}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500 dark:text-slate-400">{gifts.length} gift{gifts.length !== 1 ? "s" : ""}</div>
            {totalCost > 0 && (
              <div className="text-sm text-emerald-600 dark:text-emerald-400">${totalCost.toFixed(2)}</div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {gifts.map((gift) => (
            <GiftCard key={gift.id} gift={gift} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GiftSection({ gifts, emptyMessage }: { gifts: Gift[]; emptyMessage: string }) {
  const groupedGifts = useMemo(() => groupGiftsByHolidayDescending(gifts), [gifts]);

  if (gifts.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30">
        <CardContent className="py-8 text-center">
          <GiftIcon className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <p className="text-slate-500">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(groupedGifts.entries()).map(([holiday, holidayGifts]) => (
        <HolidayGiftGroup key={holiday.id} holiday={holiday} gifts={holidayGifts} />
      ))}
    </div>
  );
}

function HolidaysSection({ holidays }: { holidays: Holiday[] }) {
  if (holidays.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30">
        <CardContent className="py-8 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <p className="text-slate-500">No holidays associated with this person yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {holidays.map((holiday) => {
        const icon = getHolidayIcon(holiday.icon);
        return (
          <Card key={holiday.id} className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <span className="text-3xl">{icon}</span>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{holiday.name}</h3>
                {holiday.date && (
                  <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {formatDate(holiday.date)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatsSection({
  receivedCount,
  givingCount,
  totalReceiving,
  totalGiving,
}: {
  receivedCount: number;
  givingCount: number;
  totalReceiving: number;
  totalGiving: number;
}) {
  const stats = [
    { label: "Gifts Receiving", value: receivedCount, icon: Package, color: "text-violet-400" },
    { label: "Total Cost", value: `$${totalReceiving.toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
    { label: "Gifts Giving", value: givingCount, icon: Heart, color: "text-pink-400" },
    { label: "Given Value", value: `$${totalGiving.toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50", color)}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AboutSection({
  person,
  onUpdate,
  onDelete,
}: {
  person: PersonWithGifts;
  onUpdate: (updates: PersonUpdateInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(person.name);
  const [age, setAge] = useState(person.age?.toString() ?? "");
  const [gender, setGender] = useState(person.gender ?? "");
  const [birthday, setBirthday] = useState(person.birthday ?? "");
  const [milestoneLabel, setMilestoneLabel] = useState(person.milestone_label ?? "");
  const [milestoneDate, setMilestoneDate] = useState(person.milestone_date ?? "");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasChanges = name !== person.name || 
    age !== (person.age?.toString() ?? "") || 
    gender !== (person.gender ?? "") ||
    birthday !== (person.birthday ?? "") ||
    milestoneLabel !== (person.milestone_label ?? "") ||
    milestoneDate !== (person.milestone_date ?? "");

  const hasGifts = person.gifts_received.length > 0 || person.gifts_given.length > 0;

  const handleSave = async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      await onUpdate({
        name: name.trim() || person.name,
        age: age ? parseInt(age, 10) : null,
        gender: gender.trim() || null,
        birthday: birthday || null,
        milestone_label: milestoneLabel.trim() || null,
        milestone_date: milestoneDate || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog className="h-5 w-5 text-violet-500 dark:text-violet-400" />
            Edit Person
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age" className="text-slate-700 dark:text-slate-300">Age</Label>
            <Input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Optional"
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender" className="text-slate-700 dark:text-slate-300">Gender</Label>
            <Input
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Optional"
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthday" className="text-slate-700 dark:text-slate-300">Birthday</Label>
            <Input
              id="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="milestone-label" className="text-slate-700 dark:text-slate-300">Milestone Label</Label>
              <Input
                id="milestone-label"
                value={milestoneLabel}
                onChange={(e) => setMilestoneLabel(e.target.value)}
                placeholder="Work anniversary"
                className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-date" className="text-slate-700 dark:text-slate-300">Milestone Date</Label>
              <Input
                id="milestone-date"
                type="date"
                value={milestoneDate}
                onChange={(e) => setMilestoneDate(e.target.value)}
                className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full bg-violet-600 hover:bg-violet-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={hasGifts}
              className="w-full border-red-500/50 text-red-500 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Person
            </Button>
            {hasGifts && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                Cannot delete: this person has {person.gift_count} gift{person.gift_count !== 1 ? "s" : ""} attached
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Delete {person.name}?</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              This action cannot be undone. This will permanently remove {person.name} from your gift list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VerticalNav({
  activeTab,
  onTabChange,
  receivedCount,
  givingCount,
  holidaysCount,
  suggestionsCount,
}: {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  receivedCount: number;
  givingCount: number;
  holidaysCount: number;
  suggestionsCount: number;
}) {
  const tabs: { id: NavTab; label: string; icon: typeof Package; count?: number }[] = [
    { id: "received", label: "Received", icon: Package, count: receivedCount },
    { id: "giving", label: "Giving", icon: Heart, count: givingCount },
    { id: "holidays", label: "Gift Lists", icon: Sparkles, count: holidaysCount },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb, count: suggestionsCount },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "about", label: "About", icon: UserCog },
  ];

  return (
    <nav className="flex flex-col gap-1 w-full">
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
            "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
            activeTab === id
              ? "bg-violet-600/20 border border-violet-500/50 text-slate-900 dark:text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-300 border border-transparent"
          )}
        >
          <Icon className={cn("h-5 w-5", activeTab === id ? "text-violet-500 dark:text-violet-400" : "")} />
          <span className="font-medium">{label}</span>
          {count !== undefined && (
            <span className={cn(
              "ml-auto text-xs px-2 py-0.5 rounded-full",
              activeTab === id
                ? "bg-violet-500/30 text-violet-700 dark:text-violet-300"
                : "bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-500"
            )}>
              {count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export default function PersonDetailPage() {
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();
  const personId = Number(params.id);

  const [person, setPerson] = useState<PersonWithGifts | null>(null);
  const [suggestions, setSuggestions] = useState<GiftSuggestion[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("received");
  const [updatingRelationship, setUpdatingRelationship] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !personId) return;

    async function loadData() {
      try {
        const [personData, suggestionsData] = await Promise.all([
          peopleService.getWithGifts(personId),
          giftSuggestionsService.getAll(personId),
        ]);
        setPerson(personData);
        setSuggestions(suggestionsData);
      } catch {
        setError("Failed to load person. Please try again.");
      } finally {
        setDataLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, personId]);


  const handleRelationshipSelect = async (category: RelationshipCategory) => {
    if (!person || updatingRelationship) return;
    
    setUpdatingRelationship(true);
    try {
      const updated = await peopleService.update(personId, { relationship: category });
      setPerson({ ...person, relationship: updated.relationship });
    } catch {
      // Silently fail - user can try again
    } finally {
      setUpdatingRelationship(false);
    }
  };

  const handlePersonUpdate = async (updates: PersonUpdateInput) => {
    if (!person) return;
    const apiUpdates = {
      name: updates.name,
      age: updates.age ?? undefined,
      gender: updates.gender ?? undefined,
      birthday: updates.birthday,
      milestone_label: updates.milestone_label,
      milestone_date: updates.milestone_date,
    };
    const updated = await peopleService.update(personId, apiUpdates);
    setPerson({ ...person, ...updated });
    toast.success("Person updated successfully");
  };

  const handleStartEditName = () => {
    if (!person) return;
    setEditingName(person.name);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditingName("");
  };

  const handleSaveName = async () => {
    if (!person || savingName) return;
    
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      toast.error("Name cannot be empty");
      return;
    }
    
    if (trimmedName === person.name) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      await handlePersonUpdate({ name: trimmedName });
      setIsEditingName(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to update name");
      }
    } finally {
      setSavingName(false);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEditName();
    }
  };

  const handlePersonDelete = useCallback(async () => {
    try {
      await peopleService.delete(personId);
      toast.success("Person deleted successfully");
      router.push("/people");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to delete person");
      }
      throw err;
    }
  }, [personId, router]);

  // Extract unique holidays from all gifts (received + given), sorted descending by date
  const uniqueHolidays = useMemo(() => {
    if (!person) return [];
    
    const holidayMap = new Map<number, Holiday>();
    
    for (const gift of person.gifts_received) {
      if (!holidayMap.has(gift.holiday_id)) {
        holidayMap.set(gift.holiday_id, gift.holiday);
      }
    }
    for (const gift of person.gifts_given) {
      if (!holidayMap.has(gift.holiday_id)) {
        holidayMap.set(gift.holiday_id, gift.holiday);
      }
    }
    
    return Array.from(holidayMap.values()).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [person]);

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error || "Person not found"}</p>
          <Link href="/people">
            <Button>Back to People</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalReceiving = person.gifts_received.reduce(
    (sum, g) => sum + (g.cost ? parseFloat(g.cost) : 0),
    0
  );
  const totalGiving = person.gifts_given.reduce(
    (sum, g) => sum + (g.cost ? parseFloat(g.cost) : 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <Link
            href="/people"
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to People
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
              <User className="h-7 w-7 text-fuchsia-500 dark:text-fuchsia-400" />
            </div>
            <div className="flex-1 flex items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={handleNameKeyDown}
                    disabled={savingName}
                    autoFocus
                    className="text-3xl font-bold h-auto py-1 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="h-8 w-8 p-0 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    {savingName ? (
                      <div className="animate-spin h-4 w-4 border-2 border-violet-500 border-t-transparent rounded-full" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEditName}
                    disabled={savingName}
                    className="h-8 w-8 p-0 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{person.name}</h1>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartEditName}
                    className="h-8 w-8 p-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Edit name"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <Select
              value={person.relationship ?? ""}
              onValueChange={(value) => handleRelationshipSelect(value as RelationshipCategory)}
              disabled={updatingRelationship}
            >
              <SelectTrigger className="w-40 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {RELATIONSHIP_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category} className="capitalize text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content: Sidebar Nav + Content Area */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Vertical Nav */}
          <div className="lg:w-48 shrink-0">
            <VerticalNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              receivedCount={person.gifts_received.length}
              givingCount={person.gifts_given.length}
              holidaysCount={uniqueHolidays.length}
              suggestionsCount={suggestions.length}
            />
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {activeTab === "received" && (
              <GiftSection
                gifts={person.gifts_received}
                emptyMessage="No gifts assigned to this person yet"
              />
            )}
            {activeTab === "giving" && (
              <GiftSection
                gifts={person.gifts_given}
                emptyMessage="This person isn't giving any gifts yet"
              />
            )}
            {activeTab === "holidays" && (
              <HolidaysSection holidays={uniqueHolidays} />
            )}
            {activeTab === "suggestions" && (
              <GiftSuggestionsTab
                personId={personId}
                personName={person.name}
                suggestions={suggestions}
                onSuggestionsChange={setSuggestions}
              />
            )}
            {activeTab === "stats" && (
              <StatsSection
                receivedCount={person.gifts_received.length}
                givingCount={person.gifts_given.length}
                totalReceiving={totalReceiving}
                totalGiving={totalGiving}
              />
            )}
            {activeTab === "about" && (
              <AboutSection
                person={person}
                onUpdate={handlePersonUpdate}
                onDelete={handlePersonDelete}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { giftExchangesService } from "@/services";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Gift, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type ExchangeFormState = {
  name: string;
  exchange_date: string;
  budget_min: string;
  budget_max: string;
  include_creator: boolean;
};

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function nextChristmas(now = new Date()): string {
  let year = now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const christmas = new Date(year, 11, 25);

  if (christmas < today) {
    year += 1;
  }

  return toIsoDate(year, 12, 25);
}

function buildFamilyExchangeForm(): ExchangeFormState {
  const exchangeDate = nextChristmas();
  const year = exchangeDate.slice(0, 4);

  return {
    name: `Family Christmas ${year}`,
    exchange_date: exchangeDate,
    budget_min: "25",
    budget_max: "50",
    include_creator: true,
  };
}

const BLANK_EXCHANGE_FORM: ExchangeFormState = {
  name: "",
  exchange_date: "",
  budget_min: "",
  budget_max: "",
  include_creator: true,
};

export default function NewExchangePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<ExchangeFormState>(() => buildFamilyExchangeForm());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const exchange = await giftExchangesService.create({
        name: formData.name.trim(),
        exchange_date: formData.exchange_date || undefined,
        budget_min: formData.budget_min ? parseFloat(formData.budget_min) : undefined,
        budget_max: formData.budget_max ? parseFloat(formData.budget_max) : undefined,
        include_creator: formData.include_creator,
      });
      toast.success(`Created "${exchange.name}"`);
      router.push(`/exchanges/${exchange.id}`);
    } catch {
      toast.error("Failed to create exchange");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-2xl">
        <Link
          href="/exchanges"
          className="inline-flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Exchanges
        </Link>

        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl">
                <Gift className="h-6 w-6 text-violet-500 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-slate-900 dark:text-white">Create Gift Exchange</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Set up a new Secret Santa-style gift exchange
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-violet-500 dark:text-violet-400" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Fast family setup
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Christmas date, common budget, and your participant spot are ready.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData(buildFamilyExchangeForm())}
                    className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:bg-slate-950 dark:text-violet-300"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Family Christmas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData(BLANK_EXCHANGE_FORM)}
                    className="border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Blank
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
                  Exchange Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Family Christmas 2026"
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-700 dark:text-slate-300">
                  Exchange Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.exchange_date}
                  onChange={(e) => setFormData({ ...formData, exchange_date: e.target.value })}
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <p className="text-xs text-slate-500">
                  When should participants exchange gifts?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget_min" className="text-slate-700 dark:text-slate-300">
                    Minimum Budget ($)
                  </Label>
                  <Input
                    id="budget_min"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.budget_min}
                    onChange={(e) => setFormData({ ...formData, budget_min: e.target.value })}
                    placeholder="25"
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_max" className="text-slate-700 dark:text-slate-300">
                    Maximum Budget ($)
                  </Label>
                  <Input
                    id="budget_max"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.budget_max}
                    onChange={(e) => setFormData({ ...formData, budget_max: e.target.value })}
                    placeholder="50"
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <Checkbox
                  id="include_creator"
                  checked={formData.include_creator}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, include_creator: checked === true })
                  }
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="include_creator"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Include me in the exchange
                  </Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Your wishlist is ready right away, no invite acceptance needed.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Link href="/exchanges" className="flex-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={submitting || !formData.name.trim()}
                  className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
                >
                  {submitting ? "Creating..." : "Create Exchange"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

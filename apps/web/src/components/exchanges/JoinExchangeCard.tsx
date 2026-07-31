"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { exchangeJoinsService, AUTH_ROUTES } from "@/services";
import { formatExchangeBudget, formatExchangeDate } from "@/lib/exchange-invitation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, DollarSign, Users, Check, X, LogIn } from "lucide-react";
import { toast } from "sonner";
import type { ExchangeJoinDetails } from "@niftygifty/types";

export function JoinExchangeCard({
  shareToken,
  details,
}: {
  shareToken: string;
  details: ExchangeJoinDetails | null;
}) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  if (!details) {
    return (
      <PageShell>
        <Card className="border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mx-auto mb-4">
              <X className="h-8 w-8 text-red-500 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Invalid link</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              This join link is invalid or has expired.
            </p>
            <Button asChild><Link href="/">Go home</Link></Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const canonicalPath = `/e/${details.exchange.slug}/${shareToken}`;
  const authReturn = encodeURIComponent(canonicalPath);
  const exchangeDate = formatExchangeDate(details.exchange.exchange_date);
  const budget = formatExchangeBudget(details.exchange);
  const displayName = name ?? [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  const handleJoin = async () => {
    setJoining(true);
    try {
      const response = await exchangeJoinsService.join(shareToken, displayName.trim() || undefined);
      toast.success(response.message);
      router.push(`/exchanges/${response.exchange.slug}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to join exchange");
      setJoining(false);
    }
  };

  if (!details.join_open) {
    return (
      <PageShell>
        <Card className="border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 mx-auto mb-4 text-3xl">🤫</div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">This one&apos;s closed</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {details.closed_reason || "This exchange is no longer accepting new people."}
            </p>
            <Button asChild><Link href="/">Go home</Link></Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="border-slate-200 bg-white/75 shadow-xl shadow-violet-950/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/75 max-w-lg w-full">
        <CardHeader className="text-center pb-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 mx-auto mb-4 text-4xl">🎁</div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">You&apos;re invited</p>
          <CardTitle className="text-3xl text-slate-900 dark:text-white">{details.exchange.name}</CardTitle>
          <p className="text-slate-600 dark:text-slate-400">
            Organized by <span className="font-medium text-slate-900 dark:text-white">{details.exchange.owner_name}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-4 space-y-3 dark:border-slate-700 dark:bg-slate-800/60">
            {exchangeDate && <Detail icon={<Calendar className="h-4 w-4" />} text={exchangeDate} />}
            {budget && <Detail icon={<DollarSign className="h-4 w-4" />} text={`Budget: ${budget}`} />}
            <Detail
              icon={<Users className="h-4 w-4" />}
              text={`${details.exchange.accepted_count} ${details.exchange.accepted_count === 1 ? "person" : "people"} already in`}
            />
          </div>

          <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:bg-violet-950/30 dark:text-violet-100">
            Join the group, add a few wishlist ideas, and get one private match when names are drawn.
          </div>

          {authLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-name">Your name in this exchange</Label>
                <Input
                  id="join-name"
                  value={displayName}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="How should we introduce you?"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
                onClick={handleJoin}
                disabled={joining}
                data-testid="join-exchange"
              >
                {joining ? "Joining…" : <><Check className="h-4 w-4 mr-2" />Join {details.exchange.name}</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                Sign in or create a free account. We&apos;ll bring you back here to confirm.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button variant="outline" className="border-slate-300 dark:border-slate-700" asChild>
                  <Link href={`${AUTH_ROUTES.signIn}?redirect_url=${authReturn}`}>
                    <LogIn className="h-4 w-4 mr-2" />Sign in
                  </Link>
                </Button>
                <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500" asChild>
                  <Link href={`${AUTH_ROUTES.signUp}?redirect_url=${authReturn}`}>Create account</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center p-4 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </main>
  );
}

function Detail({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
      <span className="text-violet-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

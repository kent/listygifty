"use client";

import { parseCalendarDate } from "@/lib/dates";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { exchangeInvitesService, AUTH_ROUTES } from "@/services";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, DollarSign, User, Check, X, LogIn, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ExchangeInviteDetails } from "@niftygifty/types";

export default function JoinExchangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<ExchangeInviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not-found" | "load-failed" | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const authReturn = encodeURIComponent(`/join/exchange/${token}`);

  useEffect(() => {
    async function loadInvite() {
      try {
        const data = await exchangeInvitesService.getInviteDetails(token);
        setInvite(data);
      } catch (err: unknown) {
        setError(err instanceof ApiError && err.isNotFound ? "not-found" : "load-failed");
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [token, loadAttempt]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await exchangeInvitesService.acceptInvite(token);
      toast.success(response.message);
      router.push(`/exchanges/${response.exchange.slug}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to accept invite";
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await exchangeInvitesService.declineInvite(token);
      toast.success("You have declined the invitation");
      router.push("/exchanges");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to decline invite";
      toast.error(message);
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error === "load-failed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              We couldn&apos;t load this invite. Check your connection and try again.
            </p>
            <Button onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "not-found" || !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mx-auto mb-4">
              <X className="h-8 w-8 text-red-500 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Invalid Invite</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              This invite link doesn&apos;t work anymore. Ask the person who invited you for a new one.
            </p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.join_open === false && invite.participant.status !== "accepted") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 mx-auto mb-4">
              <Lock className="h-8 w-8 text-slate-600 dark:text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">This exchange has closed</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              {invite.closed_reason || "This exchange is no longer accepting new people."}
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Ask {invite.exchange.owner_name} if you think you should be in.
            </p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.participant.status === "accepted") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Already Joined!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              You have already joined {invite.exchange.name}.
            </p>
            <Link href={`/exchanges/${invite.exchange.slug}`}>
              <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500">
                Go to Exchange
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.participant.status === "declined") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 mx-auto mb-4">
              <X className="h-8 w-8 text-slate-600 dark:text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Invitation Declined</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              You previously declined this invitation.
            </p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailMismatch = !!user?.email && user.email.toLowerCase() !== invite.participant.email.toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-lg w-full relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 mx-auto mb-4 text-4xl">
            🎁
          </div>
          <CardTitle className="text-2xl text-slate-900 dark:text-white">You Are Invited!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              <span className="text-slate-900 dark:text-white font-medium">{invite.exchange.owner_name}</span> has
              invited you to join
            </p>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{invite.exchange.name}</h2>
          </div>

          <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            {invite.exchange.exchange_date && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300">
                  {parseCalendarDate(invite.exchange.exchange_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {(invite.exchange.budget_min || invite.exchange.budget_max) && (
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span className="text-slate-700 dark:text-slate-300">
                  Budget:{" "}
                  {invite.exchange.budget_min && invite.exchange.budget_max
                    ? `$${parseFloat(invite.exchange.budget_min).toFixed(0)} - $${parseFloat(invite.exchange.budget_max).toFixed(0)}`
                    : invite.exchange.budget_max
                    ? `Up to $${parseFloat(invite.exchange.budget_max).toFixed(0)}`
                    : `At least $${parseFloat(invite.exchange.budget_min!).toFixed(0)}`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-slate-700 dark:text-slate-300">
                Invited as: <span className="text-slate-900 dark:text-white">{invite.participant.name}</span>
              </span>
            </div>
          </div>

          {authLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-4">
              {emailMismatch && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm break-words text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  This invite was sent to {invite.participant.email}. You&apos;re signed in as {user.email}.
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-300 dark:border-slate-700"
                  onClick={handleDecline}
                  disabled={declining || accepting}
                >
                  {declining ? "Declining..." : "Decline"}
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
                  onClick={handleAccept}
                  disabled={accepting || declining}
                >
                  {accepting ? (
                    "Joining..."
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Join Exchange
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                Listy Gifty draws names so everyone gets one person to buy for. It&apos;s free.
              </p>
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                Sign in or create an account to join this exchange
              </p>
              <div className="flex gap-3">
                <Link href={`${AUTH_ROUTES.signIn}?redirect_url=${authReturn}`} className="flex-1">
                  <Button variant="outline" className="w-full border-slate-300 dark:border-slate-700">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
                <Link href={`${AUTH_ROUTES.signUp}?redirect_url=${authReturn}`} className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500">
                    Sign Up
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

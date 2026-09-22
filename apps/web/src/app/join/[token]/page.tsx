"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { holidaysService, AUTH_ROUTES } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Users, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Holiday } from "@niftygifty/types";

type JoinStatus = "loading" | "joining" | "success" | "error" | "already_member";

export default function JoinHolidayPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: workspaceLoading, refreshWorkspaces } = useWorkspace();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<JoinStatus>("loading");
  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Redirect to sign in, but preserve the join URL to return to
      const returnUrl = encodeURIComponent(`/join/${token}`);
      router.push(`${AUTH_ROUTES.signIn}?redirect_url=${returnUrl}`);
    }
  }, [authLoading, isAuthenticated, router, token]);

  useEffect(() => {
    if (authLoading || workspaceLoading || !isAuthenticated || !token) return;

    async function joinHoliday() {
      setStatus("joining");
      try {
        const result = await holidaysService.join(token);
        await refreshWorkspaces();
        setHoliday(result);
        setStatus("success");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to join gift list";
        if (errorMessage.includes("already a member")) {
          setStatus("already_member");
        } else {
          setError(errorMessage);
          setStatus("error");
        }
      }
    }

    joinHoliday();
  }, [authLoading, workspaceLoading, isAuthenticated, token, refreshWorkspaces]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <Card className="relative z-10 w-full max-w-md bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 backdrop-blur">
        <CardHeader className="text-center">
          {status === "loading" || status === "joining" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-violet-500 dark:text-violet-400 animate-spin" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Joining Gift List...</CardTitle>
              <CardDescription>Please wait while we add you to the gift list.</CardDescription>
            </>
          ) : status === "success" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Welcome!</CardTitle>
              <CardDescription>
                You&apos;ve joined <span className="text-slate-900 dark:text-white font-medium">{holiday?.name}</span>
              </CardDescription>
            </>
          ) : status === "already_member" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-8 w-8 text-blue-500 dark:text-blue-400" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Already a Member</CardTitle>
              <CardDescription>You&apos;re already part of this gift list.</CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Unable to Join</CardTitle>
              <CardDescription className="text-red-500 dark:text-red-400">{error || "Invalid or expired share link."}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" && holiday && (
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800/50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{holiday.name}</p>
                  {holiday.date && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(holiday.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                You can now add gifts and people to this gift list. The owner and other collaborators will see your contributions.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {(status === "success" || status === "already_member") && (
              <Link href={holiday ? `/holidays/${holiday.id}` : "/holidays"} className="w-full">
                <Button className="w-full bg-violet-600 hover:bg-violet-700">
                  {holiday ? "Open Gift List" : "Go to Gift Lists"}
                </Button>
              </Link>
            )}
            {status === "error" && (
              <Link href="/dashboard" className="w-full">
                <Button className="w-full" variant="outline">
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { workspacesService, AUTH_ROUTES } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CheckCircle, XCircle, Loader2, Gift } from "lucide-react";
import type { Workspace, WorkspaceInviteDetails } from "@niftygifty/types";

type JoinStatus = "loading" | "preview" | "joining" | "success" | "error" | "already_member";

export default function JoinWorkspacePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<JoinStatus>("loading");
  const [inviteDetails, setInviteDetails] = useState<WorkspaceInviteDetails | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load invite details (public endpoint - works without auth)
  useEffect(() => {
    if (!token) return;

    async function loadInviteDetails() {
      try {
        const details = await workspacesService.getInviteDetails(token);
        setInviteDetails(details);
        setStatus("preview");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid or expired invite link";
        setError(errorMessage);
        setStatus("error");
      }
    }

    loadInviteDetails();
  }, [token]);

  // Redirect to sign in if not authenticated (after loading invite details)
  useEffect(() => {
    if (!authLoading && !isAuthenticated && status === "preview") {
      const returnUrl = encodeURIComponent(`/join/workspace/${token}`);
      router.push(`${AUTH_ROUTES.signIn}?redirect_url=${returnUrl}`);
    }
  }, [authLoading, isAuthenticated, router, token, status]);

  const handleJoin = async () => {
    if (!isAuthenticated || !token) return;

    setStatus("joining");
    try {
      const result = await workspacesService.acceptInvite(token);
      setWorkspace(result);
      setStatus("success");

      // Refresh workspaces and switch to the new one
      await refreshWorkspaces();
      switchWorkspace(result.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to join group";
      if (errorMessage.includes("already a member")) {
        setStatus("already_member");
      } else {
        setError(errorMessage);
        setStatus("error");
      }
    }
  };

  if (authLoading && status !== "loading") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      {/* Logo */}
      <div className="absolute top-4 left-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Gift className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">Listy Gifty</span>
        </Link>
      </div>

      <Card className="relative z-10 w-full max-w-md bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 backdrop-blur">
        <CardHeader className="text-center">
          {status === "loading" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-violet-500 dark:text-violet-400 animate-spin" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Loading Invite...</CardTitle>
              <CardDescription>Please wait while we load the invitation details.</CardDescription>
            </>
          ) : status === "preview" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-violet-500 dark:text-violet-400" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Join Group</CardTitle>
              <CardDescription>
                You&apos;ve been invited to join{" "}
                <span className="text-slate-900 dark:text-white font-medium">
                  {inviteDetails?.workspace?.name}
                </span>
              </CardDescription>
            </>
          ) : status === "joining" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-violet-500 dark:text-violet-400 animate-spin" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Joining Group...</CardTitle>
              <CardDescription>Please wait while we add you to the group.</CardDescription>
            </>
          ) : status === "success" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Welcome!</CardTitle>
              <CardDescription>
                You&apos;ve joined{" "}
                <span className="text-slate-900 dark:text-white font-medium">{workspace?.name}</span>
              </CardDescription>
            </>
          ) : status === "already_member" ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-8 w-8 text-blue-500 dark:text-blue-400" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Already a Member</CardTitle>
              <CardDescription>You&apos;re already part of this group.</CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
              </div>
              <CardTitle className="text-slate-900 dark:text-white">Unable to Join</CardTitle>
              <CardDescription className="text-red-500 dark:text-red-400">
                {error || "Invalid or expired invite link."}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "preview" && inviteDetails && (
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800/50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {inviteDetails.workspace.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    You&apos;ll join as: <span className="capitalize">{inviteDetails.role}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === "success" && workspace && (
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800/50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{workspace.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Business Group</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-500">
                You can now collaborate on people, gift lists, and exchanges within this workspace.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {status === "preview" && isAuthenticated && (
              <Button
                onClick={handleJoin}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              >
                Join Group
              </Button>
            )}
            {(status === "success" || status === "already_member") && (
              <Link href="/dashboard" className="w-full">
                <Button className="w-full bg-violet-600 hover:bg-violet-700">Go to Dashboard</Button>
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

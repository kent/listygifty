"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { workspacesService, AUTH_ROUTES } from "@/services";
import { captureWebEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Gift, Loader2, CheckCircle, Users, Calendar, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const BUSINESS_USE_CASES = [
  {
    id: "holiday-box",
    title: "Remote-team holiday box",
    description: "Coordinate recipients, gift options, budgets, and delivery status.",
    workspaceName: "Holiday Gifting",
    icon: Users,
  },
  {
    id: "new-hire-kit",
    title: "New-hire onboarding kit",
    description: "Track welcome gifts from accepted offer through first-day delivery.",
    workspaceName: "Onboarding Gifts",
    icon: Gift,
  },
  {
    id: "milestones",
    title: "Work anniversaries",
    description: "Plan milestone, promotion, parental leave, and anniversary gifts.",
    workspaceName: "Milestone Gifts",
    icon: Calendar,
  },
] as const;

function getBusinessUseCase(useCaseId: string | null) {
  return BUSINESS_USE_CASES.find((useCase) => useCase.id === useCaseId) ?? BUSINESS_USE_CASES[0];
}

function BusinessSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();

  const [companyName, setCompanyName] = useState(searchParams.get("company") || "");
  const [selectedUseCaseId, setSelectedUseCaseId] = useState(
    getBusinessUseCase(searchParams.get("use_case")).id
  );
  const [workspaceName, setWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const selectedUseCase = getBusinessUseCase(selectedUseCaseId);

  // If user is authenticated and came back from signup, show the workspace creation form
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const fromSignup = searchParams.get("from") === "signup";
      if (fromSignup) {
        setShowForm(true);
      }
    }
  }, [authLoading, isAuthenticated, searchParams]);

  useEffect(() => {
    if (showForm && !workspaceName.trim()) {
      setWorkspaceName(selectedUseCase.workspaceName);
    }
  }, [selectedUseCase.workspaceName, showForm, workspaceName]);

  const handleStartSignup = () => {
    captureWebEvent("business_signup_started", {
      company_provided: Boolean(companyName.trim()),
      use_case: selectedUseCaseId,
    });

    const returnParams = new URLSearchParams({
      from: "signup",
      use_case: selectedUseCaseId,
    });
    if (companyName.trim()) {
      returnParams.set("company", companyName.trim());
    }
    const returnUrl = encodeURIComponent(`/business/signup?${returnParams.toString()}`);
    router.push(`${AUTH_ROUTES.signUp}?redirect_url=${returnUrl}`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    setIsCreating(true);
    try {
      const workspace = await workspacesService.create({
        workspace: {
          name: workspaceName.trim(),
          workspace_type: "business",
        },
        company_name: companyName.trim() || undefined,
      });

      await refreshWorkspaces();
      switchWorkspace(workspace.id);
      captureWebEvent("business_workspace_created", {
        company_provided: Boolean(companyName.trim()),
        use_case: selectedUseCaseId,
        workspace_id: workspace.id,
      });

      toast.success(`Welcome! Your workspace "${workspace.name}" is ready.`);
      router.push("/dashboard");
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Already authenticated - show workspace creation form
  if (isAuthenticated && showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 container max-w-lg mx-auto px-4 py-12">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Listy Gifty</span>
            </Link>
          </div>

          <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                Account Created!
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Now let&apos;s set up your business workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateWorkspace} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name" className="text-slate-700 dark:text-slate-300">
                    Workspace Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="workspace-name"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g., Marketing Team"
                    className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    required
                    autoFocus
                  />
                </div>

                {companyName && (
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Company</Label>
                    <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                      {companyName}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    First workflow
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedUseCase.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedUseCase.description}
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={!workspaceName.trim() || isCreating}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white h-12 text-base font-semibold"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Building2 className="h-5 w-5 mr-2" />
                      Create Workspace & Get Started
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Already authenticated but didn't come from signup - redirect to create workspace
  if (isAuthenticated) {
    router.push("/workspaces/new");
    return null;
  }

  // Not authenticated - show business signup landing
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-fuchsia-500/5 dark:from-fuchsia-900/5 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 container max-w-lg mx-auto px-4 py-12">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">Listy Gifty</span>
          </Link>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
              <Building2 className="h-8 w-8 text-violet-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              Listy Gifty for Business
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Streamline gifting for your team or organization
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* First workflows */}
            <div className="space-y-4 mb-8">
              {BUSINESS_USE_CASES.map((useCase) => {
                const UseCaseIcon = useCase.icon;
                const isSelected = selectedUseCaseId === useCase.id;

                return (
                  <button
                    key={useCase.id}
                    type="button"
                    onClick={() => setSelectedUseCaseId(useCase.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-950/30"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-violet-500/15 text-violet-600 dark:text-violet-300"
                          : "bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <UseCaseIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {useCase.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {useCase.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Signup Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name" className="text-slate-700 dark:text-slate-300">
                  Company Name <span className="text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <Button
                onClick={handleStartSignup}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white h-12 text-base font-semibold"
              >
                Get Started Free
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Already have an account?{" "}
                <Link href={AUTH_ROUTES.signIn} className="text-violet-600 dark:text-violet-400 hover:underline">
                  Sign in
                </Link>{" "}
                and create a workspace from settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function BusinessSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <BusinessSignupContent />
    </Suspense>
  );
}

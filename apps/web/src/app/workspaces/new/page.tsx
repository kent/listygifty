"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { workspacesService } from "@/services";
import { signInUrlForCurrentPage } from "@/lib/sign-in-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";

export default function CreateWorkspacePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(signInUrlForCurrentPage());
    }
  }, [authLoading, isAuthenticated, router]);

  if (!authLoading && !isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const workspace = await workspacesService.create({
        workspace: {
          name: name.trim(),
          workspace_type: "business",
        },
        company_name: companyName.trim() || undefined,
      });

      await refreshWorkspaces();
      switchWorkspace(workspace.id);

      toast.success(`Created ${workspace.name}!`);
      router.push("/dashboard");
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-fuchsia-500/5 dark:from-fuchsia-900/5 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 container max-w-lg mx-auto px-4 py-12">
        {/* Logo and Back Link */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Gift className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">Listy Gifty</span>
          </Link>
        </div>

        {/* Main Card */}
        <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
              <Building2 className="h-8 w-8 text-violet-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              Create Business Workspace
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Set up a new workspace for your team or organization
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="workspace-name" className="text-slate-700 dark:text-slate-300">
                  Workspace Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="workspace-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Marketing Team"
                  className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20"
                  required
                />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  This is the name your team will see when switching workspaces
                </p>
              </div>

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
                  className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20"
                />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  You can add more company details later in settings
                </p>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={!name.trim() || isCreating}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 disabled:shadow-none disabled:opacity-50 h-12 text-base font-semibold"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Building2 className="h-5 w-5 mr-2" />
                      Create Workspace
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info section */}
        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>
            Business workspaces allow you to collaborate with your team,
            <br />
            manage company gifting, and invite colleagues.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { workspacesService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, User, Pencil, Check, X, Loader2, Trash2, Plus, ChevronRight, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function WorkspaceSection() {
  const router = useRouter();
  const { currentWorkspace, workspaces, refreshWorkspaces, switchWorkspace } = useWorkspace();
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(currentWorkspace?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // Create workspace dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isTogglingAddresses, setIsTogglingAddresses] = useState(false);

  if (!currentWorkspace) {
    return (
      <section className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </section>
    );
  }

  const isPersonal = currentWorkspace.workspace_type === "personal";
  const isOwner = currentWorkspace.is_owner;
  const Icon = isPersonal ? User : Building2;

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await workspacesService.update(currentWorkspace.id, { workspace: { name: name.trim() } });
      await refreshWorkspaces();
      toast.success("Workspace name updated");
      setIsEditingName(false);
    } catch {
      toast.error("Failed to update workspace name");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setName(currentWorkspace.name);
    setIsEditingName(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmName !== currentWorkspace.name) {
      toast.error("Workspace name does not match");
      return;
    }

    setIsDeleting(true);
    try {
      await workspacesService.delete(currentWorkspace.id);
      toast.success("Workspace deleted");
      await refreshWorkspaces();
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmName("");
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const workspace = await workspacesService.create({
        workspace: {
          name: newWorkspaceName.trim(),
          workspace_type: "business",
        },
        company_name: newCompanyName.trim() || undefined,
      });

      await refreshWorkspaces();
      switchWorkspace(workspace.id);
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      setNewCompanyName("");
      toast.success(`Created ${workspace.name}!`);
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchWorkspace = (workspaceId: number) => {
    if (workspaceId !== currentWorkspace.id) {
      switchWorkspace(workspaceId);
      toast.success("Switched workspace");
    }
  };

  const handleToggleAddresses = async (checked: boolean) => {
    setIsTogglingAddresses(true);
    try {
      await workspacesService.update(currentWorkspace.id, {
        workspace: { show_gift_addresses: checked },
      });
      await refreshWorkspaces();
      toast.success(checked ? "Addresses enabled for gift lists" : "Addresses disabled for gift lists");
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setIsTogglingAddresses(false);
    }
  };

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Icon className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {isPersonal ? "Your personal workspace settings" : "Manage your business workspace"}
            </p>
          </div>
        </div>
      </div>

      {/* Workspace Type Badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          isPersonal
            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        }`}>
          <Icon className="h-3 w-3" />
          {isPersonal ? "Personal Workspace" : "Business Workspace"}
        </span>
        {isOwner && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
            Owner
          </span>
        )}
      </div>

      {/* Workspace Name Card */}
      <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700/50 hover:shadow-lg hover:shadow-violet-500/5">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
              <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex-1">
              {!isEditingName ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-500 block mb-1">
                      Workspace Name
                    </span>
                    <p className="text-lg font-medium text-slate-900 dark:text-white">
                      {currentWorkspace.name}
                    </p>
                  </div>
                  {isOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setName(currentWorkspace.name);
                        setIsEditingName(true);
                      }}
                      className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                    >
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Edit
                    </Button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleNameSubmit} className="space-y-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-500 block mb-4">
                    Edit Workspace Name
                  </span>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name" className="text-slate-700 dark:text-slate-300 text-sm">
                      Name
                    </Label>
                    <Input
                      id="workspace-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                      placeholder="Workspace name"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="flex-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSaving || !name.trim()}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/25 disabled:shadow-none disabled:opacity-50 transition-all duration-200"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1.5" />
                      )}
                      Save
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gift List Settings Card */}
      {isOwner && (
        <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700/50 hover:shadow-lg hover:shadow-violet-500/5">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
                <MapPin className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-500 block mb-1">
                      Gift List Settings
                    </span>
                    <p className="text-lg font-medium text-slate-900 dark:text-white">
                      Show Addresses
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {isPersonal
                        ? "Enable shipping addresses for gift recipients (useful for mail-order gifts)"
                        : "Show shipping address selection when adding gift recipients"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {isTogglingAddresses && (
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                    )}
                    <Switch
                      checked={currentWorkspace.show_gift_addresses}
                      onCheckedChange={handleToggleAddresses}
                      disabled={isTogglingAddresses}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Workspaces Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">All Workspaces</h3>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300 hover:border-violet-300 dark:hover:border-violet-700"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                  <Building2 className="h-6 w-6 text-violet-500" />
                </div>
                <DialogTitle className="text-center text-slate-900 dark:text-white">Create Business Workspace</DialogTitle>
                <DialogDescription className="text-center text-slate-600 dark:text-slate-400">
                  Set up a new workspace for your team or organization
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateWorkspace} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-workspace-name" className="text-slate-700 dark:text-slate-300">
                    Workspace Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="new-workspace-name"
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g., Marketing Team"
                    className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-company-name" className="text-slate-700 dark:text-slate-300">
                    Company Name <span className="text-slate-400">(optional)</span>
                  </Label>
                  <Input
                    id="new-company-name"
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g., Acme Corporation"
                    className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20"
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    You can add more company details later in settings
                  </p>
                </div>
                <DialogFooter className="pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isCreating}
                    className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!newWorkspaceName.trim() || isCreating}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 disabled:shadow-none disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4 mr-2" />
                        Create Workspace
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Workspace List */}
        <div className="space-y-2">
          {workspaces.map((workspace) => {
            const isCurrentWorkspace = workspace.id === currentWorkspace.id;
            const WorkspaceIcon = workspace.workspace_type === "personal" ? User : Building2;
            return (
              <button
                key={workspace.id}
                onClick={() => handleSwitchWorkspace(workspace.id)}
                className={`w-full group relative rounded-xl border transition-all duration-200 text-left ${
                  isCurrentWorkspace
                    ? "border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/20"
                    : "border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
                    workspace.workspace_type === "personal"
                      ? "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      : "bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800"
                  }`}>
                    <WorkspaceIcon className={`h-5 w-5 ${
                      workspace.workspace_type === "personal"
                        ? "text-slate-600 dark:text-slate-400"
                        : "text-violet-500 dark:text-violet-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {workspace.name}
                      </p>
                      {isCurrentWorkspace && (
                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                      {workspace.workspace_type} workspace
                      {workspace.member_count && workspace.member_count > 1 && (
                        <span className="ml-1">· {workspace.member_count} members</span>
                      )}
                    </p>
                  </div>
                  {!isCurrentWorkspace && (
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Danger Zone - Delete Workspace (only for business workspaces and owners) */}
      {!isPersonal && isOwner && (
        <div className="group relative rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
          <div className="relative p-6">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
              Once you delete a workspace, there is no going back. All data including people, holidays, and gifts will be permanently deleted.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-slate-900 dark:text-white">Delete Workspace</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                    This action cannot be undone. This will permanently delete the workspace
                    <span className="font-semibold text-slate-900 dark:text-white"> {currentWorkspace.name}</span> and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="confirm-delete" className="text-slate-700 dark:text-slate-300 text-sm">
                    Type <span className="font-mono font-semibold">{currentWorkspace.name}</span> to confirm
                  </Label>
                  <Input
                    id="confirm-delete"
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="mt-2 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    placeholder="Workspace name"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteConfirmName !== currentWorkspace.name || isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { workspacesService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Users, Copy, Loader2, UserMinus, Crown, Shield, User, Mail, X, Clock } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole } from "@niftygifty/types";

const ROLE_ICONS: Record<WorkspaceRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_COLORS: Record<WorkspaceRole, string> = {
  owner: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400",
  admin: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
  member: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

export function TeamSection() {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [selectedInviteRole, setSelectedInviteRole] = useState<WorkspaceRole>("member");
  const [inviteEmail, setInviteEmail] = useState("");

  const isOwner = currentWorkspace?.is_owner;
  const isAdmin = currentWorkspace?.is_admin;
  const canManageMembers = isOwner || isAdmin;

  const loadTeamData = useCallback(async () => {
    if (!currentWorkspace) return;

    setIsLoading(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        workspacesService.getMembers(currentWorkspace.id),
        canManageMembers ? workspacesService.getInvites(currentWorkspace.id) : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    } catch {
      toast.error("Failed to load team data");
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, canManageMembers]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const handleGenerateInvite = async () => {
    if (!currentWorkspace) return;

    setIsGeneratingInvite(true);
    try {
      const response = await workspacesService.createInvite(currentWorkspace.id, {
        workspace_invite: {
          role: selectedInviteRole,
          email: inviteEmail.trim() || undefined,
        },
      });
      // Copy to clipboard automatically
      await navigator.clipboard.writeText(response.invite_url);
      toast.success("Invite created and link copied to clipboard");
      setInviteEmail("");
      setSelectedInviteRole("member");
      loadTeamData();
    } catch {
      toast.error("Failed to generate invite link");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyInviteUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard");
    } catch {
      toast.error("Failed to copy invite link");
    }
  };

  const handleRevokeInvite = async (inviteId: number) => {
    if (!currentWorkspace) return;

    try {
      await workspacesService.revokeInvite(currentWorkspace.id, inviteId);
      toast.success("Invite revoked");
      loadTeamData();
    } catch {
      toast.error("Failed to revoke invite");
    }
  };

  const handleUpdateMemberRole = async (membershipId: number, newRole: WorkspaceRole) => {
    if (!currentWorkspace) return;

    try {
      await workspacesService.updateMember(currentWorkspace.id, membershipId, newRole);
      toast.success("Member role updated");
      loadTeamData();
    } catch {
      toast.error("Failed to update member role");
    }
  };

  const handleRemoveMember = async (membershipId: number, memberName: string) => {
    if (!currentWorkspace) return;

    try {
      await workspacesService.removeMember(currentWorkspace.id, membershipId);
      toast.success(`Removed ${memberName} from group`);
      loadTeamData();
      refreshWorkspaces();
    } catch {
      toast.error("Failed to remove member");
    }
  };

  if (!currentWorkspace) {
    return (
      <section className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Users className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Team</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Manage group members and invitations
            </p>
          </div>
        </div>
      </div>

      {/* Create Invite Section */}
      {canManageMembers && (
        <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700/50 hover:shadow-lg hover:shadow-violet-500/5">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Invite Team Members</h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Email address (optional)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <Select
                  value={selectedInviteRole}
                  onValueChange={(value) => setSelectedInviteRole(value as WorkspaceRole)}
                >
                  <SelectTrigger className="w-32 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleGenerateInvite}
                  disabled={isGeneratingInvite}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
                >
                  {isGeneratingInvite ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Create Invite
                </Button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Create an invite link to share. If you add an email, it helps track who the invite is for. Links expire in 7 days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Invites Section */}
      {canManageMembers && invites.length > 0 && (
        <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden">
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Pending Invites ({invites.length})
              </h3>
            </div>

            <div className="space-y-3">
              {invites.map((invite) => {
                const RoleIcon = ROLE_ICONS[invite.role];
                const expiresAt = new Date(invite.expires_at);
                const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={invite.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/30"
                  >
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-800 dark:text-amber-400 shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {invite.email || "Anyone with link"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}</span>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${ROLE_COLORS[invite.role]}`}>
                      <RoleIcon className="h-3 w-3" />
                      {ROLE_LABELS[invite.role]}
                    </span>

                    {/* Copy Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyInviteUrl(invite.invite_url)}
                      className="text-slate-400 hover:text-violet-500 dark:text-slate-500 dark:hover:text-violet-400"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>

                    {/* Revoke Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-900 dark:text-white">Revoke Invite</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                            Are you sure you want to revoke this invite
                            {invite.email ? (
                              <>
                                {" "}for{" "}
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {invite.email}
                                </span>
                              </>
                            ) : null}
                            ? The invite link will no longer work.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRevokeInvite(invite.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden">
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Members ({members.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role];
                const canEditThisMember =
                  canManageMembers &&
                  member.role !== "owner" &&
                  (isOwner || (isAdmin && member.role === "member"));

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/30"
                  >
                    {/* Avatar */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold text-sm shrink-0">
                      {member.first_name?.[0] || member.email[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {member.first_name && member.last_name
                          ? `${member.first_name} ${member.last_name}`
                          : member.email}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                        {member.email}
                      </p>
                    </div>

                    {/* Role Badge / Selector */}
                    {canEditThisMember ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleUpdateMemberRole(member.id, value as WorkspaceRole)}
                      >
                        <SelectTrigger className="w-32 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}>
                        <RoleIcon className="h-3 w-3" />
                        {ROLE_LABELS[member.role]}
                      </span>
                    )}

                    {/* Remove Button */}
                    {canEditThisMember && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-slate-900 dark:text-white">Remove Member</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                              Are you sure you want to remove{" "}
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {member.first_name || member.email}
                              </span>{" "}
                              from this group? They will lose access to all group data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member.id, member.first_name || member.email)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

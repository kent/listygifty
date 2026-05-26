"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { workspacesService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Gift, Globe, MapPin, Loader2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AddressesSection } from "./AddressesSection";
import { captureWebEvent } from "@/lib/analytics";
import {
  BUSINESS_USE_CASES,
  DEFAULT_BUSINESS_USE_CASE,
  getBusinessUseCase,
  getBusinessUseCaseLabel,
  type BusinessUseCaseId,
} from "@/lib/business-use-cases";
import type { CompanyProfile } from "@niftygifty/types";

function getProfileUseCaseId(profile: CompanyProfile | null): string | null {
  const useCase = profile?.tax_metadata?.initial_use_case;
  if (typeof useCase !== "string") {
    return null;
  }

  return useCase;
}

function getInitialUseCase(profile: CompanyProfile | null): string | null {
  return getBusinessUseCaseLabel(getProfileUseCaseId(profile));
}

export function CompanySection() {
  const { currentWorkspace } = useWorkspace();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [useCaseId, setUseCaseId] = useState<BusinessUseCaseId>(DEFAULT_BUSINESS_USE_CASE.id);

  const isOwner = currentWorkspace?.is_owner;
  const isAdmin = currentWorkspace?.is_admin;
  const canEdit = isOwner || isAdmin;
  const isBusiness = currentWorkspace?.workspace_type === "business";
  const initialUseCase = getInitialUseCase(profile);

  const loadProfile = useCallback(async () => {
    if (!currentWorkspace || !isBusiness) return;

    setIsLoading(true);
    try {
      const data = await workspacesService.getCompanyProfile(currentWorkspace.id);
      setProfile(data);
      setName(data.name || "");
      setWebsite(data.website || "");
      setAddress(data.address || "");
      setUseCaseId(getBusinessUseCase(getProfileUseCaseId(data)).id);
    } catch {
      // Profile might not exist yet for new workspaces
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, isBusiness]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    setIsSaving(true);
    try {
      const previousUseCase = getProfileUseCaseId(profile);
      const updatedProfile = await workspacesService.updateCompanyProfile(currentWorkspace.id, {
        company_profile: {
          name: name.trim() || undefined,
          website: website.trim() || undefined,
          address: address.trim() || undefined,
          tax_metadata: {
            ...(profile?.tax_metadata || {}),
            initial_use_case: useCaseId,
          },
        },
      });
      setProfile(updatedProfile);
      if (previousUseCase !== useCaseId) {
        captureWebEvent("business_workflow_updated", {
          previous_use_case: previousUseCase,
          use_case: useCaseId,
          workspace_id: currentWorkspace.id,
        });
      }
      toast.success("Company profile updated");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update company profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setName(profile?.name || "");
    setWebsite(profile?.website || "");
    setAddress(profile?.address || "");
    setUseCaseId(getBusinessUseCase(getProfileUseCaseId(profile)).id);
    setIsEditing(false);
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

  // Only show for business workspaces
  if (!isBusiness) {
    return (
      <section className="space-y-8">
        <div className="relative">
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
              <Building2 className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Company</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Company profiles are only available for business workspaces
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 p-8 text-center">
          <Building2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Switch to a business workspace to manage company profile settings.
          </p>
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
            <Building2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Company</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Manage your company profile and information
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : (
        <div className="group relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700/50 hover:shadow-lg hover:shadow-violet-500/5">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative p-6">
            {!isEditing ? (
              <div className="space-y-6">
                {/* Company Name */}
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
                    <Building2 className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-1">
                      Company Name
                    </span>
                    <p className="text-lg font-medium text-slate-900 dark:text-white">
                      {profile?.name || "Not set"}
                    </p>
                  </div>
                </div>

                {/* Website */}
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
                    <Globe className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-1">
                      Website
                    </span>
                    {profile?.website ? (
                      <a
                        href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-medium text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        {profile.website}
                      </a>
                    ) : (
                      <p className="text-lg font-medium text-slate-400 dark:text-slate-500">Not set</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
                    <MapPin className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-1">
                      Address
                    </span>
                    <p className="text-lg font-medium text-slate-900 dark:text-white whitespace-pre-line">
                      {profile?.address || "Not set"}
                    </p>
                  </div>
                </div>

                {/* Initial Workflow */}
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
                    <Gift className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-1">
                      Initial Workflow
                    </span>
                    <p className="text-lg font-medium text-slate-900 dark:text-white">
                      {initialUseCase || "Not set"}
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Company Profile
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Edit Company Profile
                </h3>

                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-slate-700 dark:text-slate-300 text-sm">
                    Company Name
                  </Label>
                  <Input
                    id="company-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                    placeholder="Acme Corporation"
                  />
                </div>

                {/* Website */}
                <div className="space-y-2">
                  <Label htmlFor="company-website" className="text-slate-700 dark:text-slate-300 text-sm">
                    Website
                  </Label>
                  <Input
                    id="company-website"
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                    placeholder="www.example.com"
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="company-address" className="text-slate-700 dark:text-slate-300 text-sm">
                    Address
                  </Label>
                  <Textarea
                    id="company-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-violet-500/20 transition-all resize-none"
                    placeholder="123 Main St&#10;San Francisco, CA 94102"
                    rows={3}
                  />
                </div>

                {/* Initial Workflow */}
                <div className="space-y-2">
                  <Label htmlFor="company-use-case" className="text-slate-700 dark:text-slate-300 text-sm">
                    Initial Workflow
                  </Label>
                  <Select
                    value={useCaseId}
                    onValueChange={(value) => setUseCaseId(value as BusinessUseCaseId)}
                  >
                    <SelectTrigger
                      id="company-use-case"
                      className="w-full bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      {BUSINESS_USE_CASES.map((useCase) => (
                        <SelectItem key={useCase.id} value={useCase.id}>
                          {useCase.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    disabled={isSaving}
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
      )}

      {/* Addresses Section */}
      {!isLoading && <AddressesSection />}
    </section>
  );
}

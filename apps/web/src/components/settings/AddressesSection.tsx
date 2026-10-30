"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { workspacesService } from "@/services";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { AddressDialog } from "./AddressDialog";
import type { Address, CreateAddressRequest } from "@niftygifty/types";

export function AddressesSection() {
  const { currentWorkspace } = useWorkspace();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusiness = currentWorkspace?.workspace_type === "business";
  const isAdmin = currentWorkspace?.is_admin || currentWorkspace?.is_owner;

  const loadAddresses = useCallback(async () => {
    if (!currentWorkspace || !isBusiness) return;

    setIsLoading(true);
    try {
      const data = await workspacesService.getAddresses(currentWorkspace.id);
      setAddresses(data);
    } catch {
      // No addresses yet or error
      setAddresses([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, isBusiness]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleCreateOrUpdate = async (data: CreateAddressRequest) => {
    if (!currentWorkspace) return;

    setIsSubmitting(true);
    try {
      if (editingAddress) {
        await workspacesService.updateAddress(
          currentWorkspace.id,
          editingAddress.id,
          data
        );
        toast.success("Address updated");
      } else {
        await workspacesService.createAddress(currentWorkspace.id, data);
        toast.success("Address added");
      }
      setIsDialogOpen(false);
      setEditingAddress(null);
      loadAddresses();
    } catch {
      toast.error(editingAddress ? "Failed to update address" : "Failed to add address");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentWorkspace || !deletingAddress) return;

    setIsSubmitting(true);
    try {
      await workspacesService.deleteAddress(
        currentWorkspace.id,
        deletingAddress.id
      );
      toast.success("Address deleted");
      setDeletingAddress(null);
      loadAddresses();
    } catch {
      toast.error("Failed to delete address");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (address: Address) => {
    if (!currentWorkspace) return;

    try {
      await workspacesService.setDefaultAddress(currentWorkspace.id, address.id);
      toast.success("Default address updated");
      loadAddresses();
    } catch {
      toast.error("Failed to set default address");
    }
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAddress(null);
    setIsDialogOpen(true);
  };

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // Only show for business workspaces
  if (!isBusiness) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <MapPin className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Company Addresses
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage shipping and office locations
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={openCreateDialog}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Address
          </Button>
        )}
      </div>

      {/* Address List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 p-8 text-center">
          <Building2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            No addresses yet. Add your first company address.
          </p>
          {isAdmin && (
            <Button
              onClick={openCreateDialog}
              variant="outline"
              className="border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="group relative rounded-xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700/50 hover:shadow-md"
            >
              <div className="p-4 flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                  <MapPin className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {address.label}
                    </span>
                    {address.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                        <Star className="h-3 w-3" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
                    {address.formatted_address}
                  </p>
                </div>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(address)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {!address.is_default && (
                        <DropdownMenuItem
                          onClick={() => handleSetDefault(address)}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeletingAddress(address)}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Address Dialog */}
      <AddressDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingAddress(null);
        }}
        onSubmit={handleCreateOrUpdate}
        address={editingAddress}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingAddress}
        onOpenChange={(open) => !open && setDeletingAddress(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingAddress?.label}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

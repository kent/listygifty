"use client";

import { useState, use, useEffect, useCallback } from "react";
import { wishlistsService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Gift,
  ShoppingCart,
  ExternalLink,
  Check,
  AlertTriangle,
  Calendar,
  ListTodo,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { GuestClaimDetailsResponse } from "@niftygifty/types";
import { BRAND_NAME } from "@/lib/brand";

export default function GuestClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [claimData, setClaimData] = useState<GuestClaimDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [wasDeleted, setWasDeleted] = useState(false);

  const fetchClaim = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await wishlistsService.getGuestClaim(token);
      setClaimData(data);
    } catch {
      setError("This claim link is invalid or has expired.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchClaim();
  }, [fetchClaim]);

  const handleMarkPurchased = async () => {
    setIsUpdating(true);
    try {
      const updatedClaim = await wishlistsService.updateGuestClaim(token, { purchased: true });
      setClaimData((prev) => prev ? { ...prev, claim: updatedClaim } : prev);
      toast.success("Marked as purchased!");
    } catch {
      toast.error("Failed to update claim");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      await wishlistsService.deleteGuestClaim(token);
      toast.success("Claim removed successfully");
      setClaimData(null);
      setWasDeleted(true);
      setShowDeleteDialog(false);
    } catch {
      toast.error("Failed to remove claim");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (wasDeleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center px-4">
          <Check className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Claim Removed
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-md">
            Your claim has been successfully removed. The item is now available for others to claim.
          </p>
        </div>
      </div>
    );
  }

  if (error || !claimData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="h-16 w-16 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Claim Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
            {error || "This claim link is invalid or has expired."}
          </p>
          <Button variant="outline" onClick={fetchClaim}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { claim, item, wishlist } = claimData;
  const claimedAt = new Date(claim.claimed_at);
  const formattedClaimedAt = claimedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      {/* Simple header */}
      <header className="relative z-10 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            <span className="font-semibold text-slate-900 dark:text-white">{BRAND_NAME}</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Manage Your Claim
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Update or remove your gift claim
          </p>
        </div>

        {/* Wishlist info */}
        <Card className="mb-6 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ListTodo className="h-4 w-4" />
              From Wishlist
            </div>
            <CardTitle className="text-lg">{wishlist.name}</CardTitle>
            {wishlist.owner && (
              <CardDescription>
                Created by {wishlist.owner.name}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        {/* Claim details */}
        <Card className="mb-6 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl">{item.name}</CardTitle>
            {item.notes && (
              <CardDescription>{item.notes}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                className={
                  claim.status === "purchased"
                    ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50"
                    : "bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/50"
                }
              >
                {claim.status === "purchased" ? (
                  <>
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Purchased
                  </>
                ) : (
                  <>
                    <Gift className="h-3 w-3 mr-1" />
                    Reserved
                  </>
                )}
              </Badge>

              <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Claimed on {formattedClaimedAt}
              </span>
            </div>

            {item.price_display && (
              <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                {item.price_display}
              </div>
            )}

            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                View Product Link
              </a>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          {claim.status !== "purchased" && (
            <Button
              onClick={handleMarkPurchased}
              disabled={isUpdating}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isUpdating ? "Updating..." : "Mark as Purchased"}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isUpdating}
            className="w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Claim
          </Button>
        </div>

        {/* Info notice */}
        <Card className="mt-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">Keep this link safe</p>
                <p>
                  This is your private link to manage your claim. Do not share it with others.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Claim?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove your claim on &quot;{item.name}&quot;? This will allow others
              to claim this item.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Claim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

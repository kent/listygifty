"use client";

import { useState, use, useEffect, useCallback } from "react";
import { wishlistsService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  Check,
  ExternalLink,
  Gift,
  ShoppingCart,
  Star,
  Sparkles,
  Calendar,
  Mail,
  User,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { WishlistWithItems, StandaloneWishlistItem, GuestClaimRequest } from "@niftygifty/types";
import { BRAND_NAME } from "@/lib/brand";

function PriorityBadge({ priority }: { priority: number }) {
  if (priority === 2) {
    return (
      <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50">
        <Sparkles className="h-3 w-3 mr-1" />
        Most Wanted
      </Badge>
    );
  }
  if (priority === 1) {
    return (
      <Badge className="bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/50">
        <Star className="h-3 w-3 mr-1" />
        High Priority
      </Badge>
    );
  }
  return null;
}

function PublicItemCard({
  item,
  onClaim,
}: {
  item: StandaloneWishlistItem;
  onClaim: (item: StandaloneWishlistItem) => void;
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-medium text-slate-900 dark:text-white">{item.name}</h3>
              <PriorityBadge priority={item.priority} />
            </div>

            {item.notes && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{item.notes}</p>
            )}

            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
              {item.price_display && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {item.price_display}
                </span>
              )}
              {item.quantity > 1 && (
                <span>Qty: {item.quantity}</span>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="hidden sm:inline">View Link</span>
                  <span className="sm:hidden">Link</span>
                </a>
              )}
            </div>

            {!item.is_available && (
              <Badge variant="outline" className="mt-2 bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50">
                <Check className="h-3 w-3 mr-1" />
                Claimed
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.is_available && (
              <Button
                size="sm"
                onClick={() => onClaim(item)}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
              >
                <Gift className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Claim This</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicWishlistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [wishlist, setWishlist] = useState<WishlistWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Claim dialog state
  const [claimingItem, setClaimingItem] = useState<StandaloneWishlistItem | null>(null);
  const [claimerName, setClaimerName] = useState("");
  const [claimerEmail, setClaimerEmail] = useState("");
  const [isPurchased, setIsPurchased] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWishlist = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await wishlistsService.getPublicWishlist(token);
      setWishlist(data);
    } catch {
      setError("This wishlist could not be found or is no longer shared.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingItem || !claimerName.trim() || !claimerEmail.trim()) return;

    setIsSubmitting(true);
    try {
      const claimData: GuestClaimRequest["claim"] = {
        claimer_name: claimerName.trim(),
        claimer_email: claimerEmail.trim(),
        quantity: 1,
        purchased: isPurchased,
      };

      await wishlistsService.publicClaimItem(token, claimingItem.id, claimData);

      // Update local state
      setWishlist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          wishlist_items: prev.wishlist_items.map((item) =>
            item.id === claimingItem.id
              ? {
                  ...item,
                  is_available: item.available_quantity - 1 <= 0,
                  available_quantity: item.available_quantity - 1,
                  claimed_quantity: item.claimed_quantity + 1,
                }
              : item
          ),
        };
      });

      toast.success(
        "Item claimed! Check your email for a confirmation link to manage your claim."
      );
      setClaimingItem(null);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to claim item";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setClaimerName("");
    setClaimerEmail("");
    setIsPurchased(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !wishlist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="h-16 w-16 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Wishlist Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
            {error || "This wishlist could not be found or is no longer available."}
          </p>
          <Button variant="outline" onClick={fetchWishlist}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const items = wishlist.wishlist_items || [];
  const targetDate = wishlist.target_date ? new Date(wishlist.target_date) : null;
  const formattedDate = targetDate
    ? targetDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

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

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        {/* Wishlist header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {wishlist.name}
          </h1>
          {wishlist.description && (
            <p className="text-slate-600 dark:text-slate-400 mb-4">{wishlist.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Gift className="h-4 w-4" />
              {items.length} items
            </span>
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formattedDate}
              </span>
            )}
          </div>
          {wishlist.owner && (
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              By <span className="font-medium text-slate-900 dark:text-white">{wishlist.owner.name}</span>
            </p>
          )}
        </div>

        {/* Info card */}
        <Card className="mb-6 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800">
          <CardContent className="py-4">
            <p className="text-sm text-violet-700 dark:text-violet-300 text-center">
              Claim items to let others know what you&apos;re planning to get.
              {wishlist.anti_spoiler_enabled && (
                <> The owner won&apos;t see who claimed what until they choose to reveal it.</>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Items */}
        {items.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
            <Gift className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No Items Yet
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              This wishlist is empty. Check back later!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <PublicItemCard
                key={item.id}
                item={item}
                onClaim={(i) => setClaimingItem(i)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Claim Dialog */}
      <Dialog open={!!claimingItem} onOpenChange={(open) => !open && setClaimingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Claim Item</DialogTitle>
            <DialogDescription>
              Let others know you&apos;re getting &quot;{claimingItem?.name}&quot; to avoid duplicate gifts.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleClaim} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                Your Name *
              </label>
              <Input
                value={claimerName}
                onChange={(e) => setClaimerName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                Your Email *
              </label>
              <Input
                type="email"
                value={claimerEmail}
                onChange={(e) => setClaimerEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                We&apos;ll send you a link to manage your claim. Your email won&apos;t be shared.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium">Have you already purchased it?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!isPurchased ? "default" : "outline"}
                  className={!isPurchased ? "bg-violet-500 hover:bg-violet-600 flex-1" : "flex-1"}
                  onClick={() => setIsPurchased(false)}
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Planning to Buy
                </Button>
                <Button
                  type="button"
                  variant={isPurchased ? "default" : "outline"}
                  className={isPurchased ? "bg-green-500 hover:bg-green-600 flex-1" : "flex-1"}
                  onClick={() => setIsPurchased(true)}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Already Purchased
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setClaimingItem(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !claimerName.trim() || !claimerEmail.trim()}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  "Claim Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, use } from "react";
import Link from "next/link";
import { wishlistsService } from "@/services";
import { useWorkspaceData } from "@/hooks";
import { AppHeader } from "@/components/layout";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Share2,
  Copy,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Gift,
  ShoppingCart,
  X,
  Star,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { WishlistWithItems, StandaloneWishlistItem, WishlistItemPriority } from "@niftygifty/types";

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

function ItemCard({
  item,
  isOwner,
  onClaim,
  onUnclaim,
  onMarkPurchased,
  onEdit,
  onDelete,
}: {
  item: StandaloneWishlistItem;
  isOwner: boolean;
  onClaim: (itemId: number, purchased: boolean) => Promise<void>;
  onUnclaim: (itemId: number) => Promise<void>;
  onMarkPurchased: (itemId: number) => Promise<void>;
  onEdit: (item: StandaloneWishlistItem) => void;
  onDelete: (item: StandaloneWishlistItem) => void;
}) {
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async (purchased: boolean) => {
    setClaiming(true);
    try {
      await onClaim(item.id, purchased);
    } finally {
      setClaiming(false);
    }
  };

  const handleUnclaim = async () => {
    setClaiming(true);
    try {
      await onUnclaim(item.id);
    } finally {
      setClaiming(false);
    }
  };

  const handleMarkPurchased = async () => {
    setClaiming(true);
    try {
      await onMarkPurchased(item.id);
    } finally {
      setClaiming(false);
    }
  };

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
                  View Link
                </a>
              )}
            </div>

            {!item.is_available && !item.my_claim && (
              <Badge variant="outline" className="mt-2 bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50">
                <Check className="h-3 w-3 mr-1" />
                Claimed
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Claim buttons for non-owners */}
            {!isOwner && (
              <>
                {item.my_claim ? (
                  <div className="flex items-center gap-2">
                    <Badge className={item.my_claim.status === "purchased"
                      ? "bg-green-500/20 text-green-600 border-green-500/50"
                      : "bg-violet-500/20 text-violet-600 border-violet-500/50"
                    }>
                      {item.my_claim.status === "purchased" ? "Purchased" : "Reserved"}
                    </Badge>
                    {item.my_claim.status === "reserved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkPurchased}
                        disabled={claiming}
                        title="Mark as purchased"
                      >
                        {claiming ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUnclaim}
                      disabled={claiming}
                      title="Remove claim"
                    >
                      {claiming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : item.is_available ? (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClaim(false)}
                      disabled={claiming}
                    >
                      {claiming ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Gift className="h-4 w-4 mr-1" />
                      )}
                      <span className="hidden sm:inline">Reserve</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleClaim(true)}
                      disabled={claiming}
                      className="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    >
                      {claiming ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 mr-1" />
                      )}
                      <span className="hidden sm:inline">Purchased</span>
                    </Button>
                  </div>
                ) : null}
              </>
            )}

            {/* Owner menu */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WishlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<StandaloneWishlistItem | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [itemName, setItemName] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemPriceMin, setItemPriceMin] = useState("");
  const [itemPriceMax, setItemPriceMax] = useState("");
  const [itemPriority, setItemPriority] = useState<WishlistItemPriority>(0);
  const [itemQuantity, setItemQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<StandaloneWishlistItem | null>(null);
  const [showRevealConfirm, setShowRevealConfirm] = useState(false);

  const {
    data: wishlist,
    setData: setWishlist,
    isLoading,
    error,
    user,
    signOut,
    refetch,
  } = useWorkspaceData<WishlistWithItems | null>({
    resourceKey: String(id),
    fetcher: () => wishlistsService.getById(Number(id)),
    initialData: null,
  });

  const handleShare = async () => {
    if (!wishlist) return;

    try {
      const result = await wishlistsService.share(wishlist.id);
      setWishlist({
        ...wishlist,
        share_token: result.share_token,
        share_url: result.share_url,
        visibility: result.visibility,
      });
      setShowShareDialog(true);
    } catch {
      toast.error("Failed to create share link");
    }
  };

  const copyShareLink = async () => {
    if (!wishlist?.share_url) return;

    try {
      await navigator.clipboard.writeText(wishlist.share_url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleRevealClaims = async () => {
    if (!wishlist) return;

    try {
      const result = await wishlistsService.revealClaims(wishlist.id);
      toast.success(`${result.revealed_count} claims revealed`);
      setShowRevealConfirm(false);
      refetch();
    } catch {
      toast.error("Failed to reveal claims");
    }
  };

  const resetItemForm = () => {
    setItemName("");
    setItemNotes("");
    setItemUrl("");
    setItemPriceMin("");
    setItemPriceMax("");
    setItemPriority(0);
    setItemQuantity("1");
    setEditingItem(null);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlist || !itemName.trim()) return;

    setIsSubmitting(true);
    try {
      const newItem = await wishlistsService.createItem(wishlist.id, {
        name: itemName.trim(),
        notes: itemNotes.trim() || undefined,
        url: itemUrl.trim() || undefined,
        price_min: itemPriceMin ? Number(itemPriceMin) : undefined,
        price_max: itemPriceMax ? Number(itemPriceMax) : undefined,
        priority: itemPriority,
        quantity: Number(itemQuantity) || 1,
      });

      setWishlist({
        ...wishlist,
        wishlist_items: [...wishlist.wishlist_items, newItem],
      });
      toast.success("Item added");
      setShowAddItemDialog(false);
      resetItemForm();
    } catch {
      toast.error("Failed to add item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlist || !editingItem || !itemName.trim()) return;

    setIsSubmitting(true);
    try {
      const updatedItem = await wishlistsService.updateItem(wishlist.id, editingItem.id, {
        name: itemName.trim(),
        notes: itemNotes.trim() || undefined,
        url: itemUrl.trim() || undefined,
        price_min: itemPriceMin ? Number(itemPriceMin) : undefined,
        price_max: itemPriceMax ? Number(itemPriceMax) : undefined,
        priority: itemPriority,
        quantity: Number(itemQuantity) || 1,
      });

      setWishlist({
        ...wishlist,
        wishlist_items: wishlist.wishlist_items.map((item) =>
          item.id === editingItem.id ? updatedItem : item
        ),
      });
      toast.success("Item updated");
      setEditingItem(null);
      resetItemForm();
    } catch {
      toast.error("Failed to update item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!wishlist || !deleteConfirmItem) return;

    try {
      await wishlistsService.deleteItem(wishlist.id, deleteConfirmItem.id);
      setWishlist({
        ...wishlist,
        wishlist_items: wishlist.wishlist_items.filter((i) => i.id !== deleteConfirmItem.id),
      });
      toast.success("Item deleted");
      setDeleteConfirmItem(null);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleClaim = async (itemId: number, purchased: boolean) => {
    if (!wishlist) return;

    try {
      const claim = await wishlistsService.claimItem(wishlist.id, itemId, 1, purchased);
      setWishlist({
        ...wishlist,
        wishlist_items: wishlist.wishlist_items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                my_claim: claim,
                is_available: item.available_quantity - 1 <= 0,
                available_quantity: item.available_quantity - 1,
                claimed_quantity: item.claimed_quantity + 1,
              }
            : item
        ),
      });
      toast.success(purchased ? "Item marked as purchased" : "Item reserved");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to claim item";
      toast.error(message);
    }
  };

  const handleUnclaim = async (itemId: number) => {
    if (!wishlist) return;

    try {
      await wishlistsService.unclaimItem(wishlist.id, itemId);
      setWishlist({
        ...wishlist,
        wishlist_items: wishlist.wishlist_items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                my_claim: null,
                is_available: true,
                available_quantity: item.available_quantity + 1,
                claimed_quantity: item.claimed_quantity - 1,
              }
            : item
        ),
      });
      toast.success("Claim removed");
    } catch {
      toast.error("Failed to remove claim");
    }
  };

  const handleMarkPurchased = async (itemId: number) => {
    if (!wishlist) return;

    try {
      const updatedClaim = await wishlistsService.markPurchased(wishlist.id, itemId);
      setWishlist({
        ...wishlist,
        wishlist_items: wishlist.wishlist_items.map((item) =>
          item.id === itemId
            ? { ...item, my_claim: updatedClaim }
            : item
        ),
      });
      toast.success("Marked as purchased");
    } catch {
      toast.error("Failed to mark as purchased");
    }
  };

  const openEditDialog = (item: StandaloneWishlistItem) => {
    setItemName(item.name);
    setItemNotes(item.notes || "");
    setItemUrl(item.url || "");
    setItemPriceMin(item.price_min || "");
    setItemPriceMax(item.price_max || "");
    setItemPriority(item.priority);
    setItemQuantity(String(item.quantity));
    setEditingItem(item);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <AppHeader user={user} onSignOut={signOut} />
        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Failed to load wishlist
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Link href="/wishlists">
                <Button variant="outline">Back to Wishlists</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!wishlist) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Wishlist Not Found</h1>
          <Link href="/wishlists">
            <Button variant="outline">Back to Wishlists</Button>
          </Link>
        </div>
      </div>
    );
  }

  const items = wishlist.wishlist_items || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <Link
          href="/wishlists"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Wishlists
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{wishlist.name}</h1>
            {wishlist.description && (
              <p className="text-slate-600 dark:text-slate-400 mb-2">{wishlist.description}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{items.length} items</span>
              {wishlist.claimed_count > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  {wishlist.claimed_count} claimed
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {wishlist.is_owner && (
              <>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
                {wishlist.anti_spoiler_enabled && (
                  <Button variant="outline" size="sm" onClick={() => setShowRevealConfirm(true)}>
                    <Eye className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Reveal</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setShowAddItemDialog(true)}
                  className="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Item</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Anti-spoiler banner for owner */}
        {wishlist.is_owner && wishlist.anti_spoiler_enabled && (
          <Card className="mb-6 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <EyeOff className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <div>
                  <p className="font-medium text-violet-900 dark:text-violet-100">
                    Anti-Spoiler Mode Active
                  </p>
                  <p className="text-sm text-violet-600 dark:text-violet-400">
                    Claim details are hidden. Click &quot;Reveal Claims&quot; to see who claimed what.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items */}
        {items.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
            <Gift className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Items Yet</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
              {wishlist.is_owner
                ? "Start adding items to your wishlist so others know what to get you."
                : "This wishlist is empty. Check back later!"}
            </p>
            {wishlist.is_owner && (
              <Button
                onClick={() => setShowAddItemDialog(true)}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Item
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isOwner={wishlist.is_owner}
                onClaim={handleClaim}
                onUnclaim={handleUnclaim}
                onMarkPurchased={handleMarkPurchased}
                onEdit={openEditDialog}
                onDelete={setDeleteConfirmItem}
              />
            ))}
          </div>
        )}
      </main>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Wishlist</DialogTitle>
            <DialogDescription>
              Anyone with this link can view your wishlist and claim items.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={wishlist.share_url || ""}
              readOnly
              className="bg-slate-100 dark:bg-slate-800"
            />
            <Button onClick={copyShareLink} variant="outline">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Dialog */}
      <Dialog
        open={showAddItemDialog || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddItemDialog(false);
            resetItemForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the item details" : "Add a new item to your wishlist"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editingItem ? handleEditItem : handleAddItem} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Color, size, or other preferences"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Link</label>
              <Input
                value={itemUrl}
                onChange={(e) => setItemUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Price</label>
                <Input
                  type="number"
                  value={itemPriceMin}
                  onChange={(e) => setItemPriceMin(e.target.value)}
                  placeholder="$0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Price</label>
                <Input
                  type="number"
                  value={itemPriceMax}
                  onChange={(e) => setItemPriceMax(e.target.value)}
                  placeholder="$0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={itemPriority}
                  onChange={(e) => setItemPriority(Number(e.target.value) as WishlistItemPriority)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <option value={0}>Normal</option>
                  <option value={1}>High</option>
                  <option value={2}>Most Wanted</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddItemDialog(false);
                  resetItemForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !itemName.trim()}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500"
              >
                {isSubmitting ? "Saving..." : editingItem ? "Save Changes" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmItem} onOpenChange={() => setDeleteConfirmItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirmItem?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal Claims Confirmation Dialog */}
      <Dialog open={showRevealConfirm} onOpenChange={setShowRevealConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal All Claims</DialogTitle>
            <DialogDescription>
              This will show you who has claimed or purchased items on your wishlist. This cannot be undone.
              Are you sure you want to reveal all claims?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevealConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleRevealClaims}>
              <Eye className="h-4 w-4 mr-2" />
              Reveal Claims
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

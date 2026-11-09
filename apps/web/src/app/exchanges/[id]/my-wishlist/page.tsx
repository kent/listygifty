"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  exchangeParticipantsService,
  giftExchangesService,
  wishlistItemsService,
  wishlistsService,
} from "@/services";
import { moveItem } from "@/lib/move-item";
import { ItemOrderControls, ItemRank } from "@/components/wishlists/item-order-controls";
import { signInUrlForCurrentPage } from "@/lib/sign-in-redirect";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { ExchangeWishlistRef, GiftExchange, Wishlist, WishlistItem } from "@niftygifty/types";

// Older APIs send one price and no display string.
function priceLabel(item: WishlistItem): string | null {
  if (item.price_display) return item.price_display;
  return item.price ? `$${parseFloat(item.price).toFixed(2)}` : null;
}

export default function MyWishlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = use(params);
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const [exchange, setExchange] = useState<GiftExchange | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adding, setAdding] = useState(false);
  const [myWishlists, setMyWishlists] = useState<Wishlist[]>([]);
  const [switching, setSwitching] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    link: "",
    price: "",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(signInUrlForCurrentPage());
    }
  }, [authLoading, isAuthenticated, router]);

  const loadItems = useCallback(async (exchangeId: number, participantId: number) => {
    setItems(await wishlistItemsService.getAll(exchangeId, participantId));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        const exchangeData = await giftExchangesService.getBySlug(slug);
        setExchange(exchangeData);

        if (exchangeData.my_participant) {
          await loadItems(exchangeData.id, exchangeData.my_participant.id);
          // Only for offering a different list. The page works without it.
          wishlistsService
            .getAll()
            .then((lists) => setMyWishlists(lists.filter((list) => list.is_owner)))
            .catch(() => setMyWishlists([]));
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, slug, loadItems]);

  const handleMove = async (index: number, delta: -1 | 1) => {
    if (!exchange?.my_participant) return;
    const reordered = moveItem(items, index, delta);
    if (reordered === items) return;

    setItems(reordered);
    try {
      setItems(
        await wishlistItemsService.reorder(
          exchange.id,
          exchange.my_participant.id,
          reordered.map((item) => item.id)
        )
      );
    } catch {
      toast.error("Couldn't save the new order");
      await loadItems(exchange.id, exchange.my_participant.id).catch(() => undefined);
    }
  };

  const handleChooseWishlist = async (wishlistId: number) => {
    const me = exchange?.my_participant;
    if (!exchange || !me || wishlistId === me.wishlist?.id) return;

    setSwitching(true);
    try {
      const updated = await exchangeParticipantsService.chooseWishlist(exchange.id, me.id, wishlistId);
      setExchange({ ...exchange, my_participant: { ...me, wishlist: updated.wishlist ?? null } });
      await loadItems(exchange.id, me.id);
    } catch {
      toast.error("Couldn't switch wishlists");
    } finally {
      setSwitching(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !exchange?.my_participant) return;

    setAdding(true);
    try {
      const item = await wishlistItemsService.create(
        exchange.id,
        exchange.my_participant.id,
        {
          name: newItem.name.trim(),
          description: newItem.description.trim() || undefined,
          link: newItem.link.trim() || undefined,
          price: newItem.price ? parseFloat(newItem.price) : undefined,
        }
      );
      setItems((prev) => [...prev, item]);
      setNewItem({ name: "", description: "", link: "", price: "" });
      setShowAddDialog(false);
      toast.success("Item added to wishlist");
    } catch {
      toast.error("Failed to add item");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteItem = async (item: WishlistItem) => {
    if (!exchange?.my_participant) return;

    try {
      await wishlistItemsService.delete(exchange.id, exchange.my_participant.id, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Item removed");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!exchange || !exchange.my_participant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">You are not a participant in this exchange</p>
          <Link href="/exchanges">
            <Button className="mt-4">Back to Exchanges</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href={`/exchanges/${slug}`}
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to {exchange.name}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">My Wishlist</h1>
            <p className="break-words text-slate-600 dark:text-slate-400">
              Add items you would like to receive for {exchange.name}
            </p>
            <p className="break-words text-sm text-slate-500 dark:text-slate-400 mt-1">
              Your Secret Santa sees these in this order. Put the ones you want most at the top.
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-white">Add Wishlist Item</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wishlist-item-name" className="text-slate-700 dark:text-slate-300">Name *</Label>
                  <Input
                    id="wishlist-item-name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="What would you like?"
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wishlist-item-description" className="text-slate-700 dark:text-slate-300">Description</Label>
                  <Textarea
                    id="wishlist-item-description"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Size, color, or other details..."
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wishlist-item-link" className="text-slate-700 dark:text-slate-300">Link</Label>
                  <Input
                    id="wishlist-item-link"
                    type="url"
                    value={newItem.link}
                    onChange={(e) => setNewItem({ ...newItem, link: e.target.value })}
                    placeholder="https://..."
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wishlist-item-price" className="text-slate-700 dark:text-slate-300">Approximate Price ($)</Label>
                  <Input
                    id="wishlist-item-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="25.00"
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={adding || !newItem.name.trim()}>
                    {adding ? "Adding..." : "Add Item"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {exchange.my_participant.wishlist && (
          <WishlistInUse
            current={exchange.my_participant.wishlist}
            choices={myWishlists}
            switching={switching}
            onChoose={handleChooseWishlist}
          />
        )}

        {items.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
            <CardContent className="py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4">
                <Plus className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No items yet</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Add items to your wishlist so your Secret Santa knows what you want!
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Item
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <Card key={item.id} className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex items-center gap-1">
                      <ItemRank rank={index + 1} />
                      <ItemOrderControls
                        rank={index + 1}
                        total={items.length}
                        itemName={item.name}
                        onMove={(delta) => handleMove(index, delta)}
                      />
                    </div>
                    {item.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="h-6 w-6 text-slate-400 dark:text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="break-words font-semibold text-slate-900 dark:text-white">{item.name}</h3>
                      {item.description && (
                        <p className="break-words text-sm text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm">
                        {priceLabel(item) && (
                          <span className="text-slate-600 dark:text-slate-400">{priceLabel(item)}</span>
                        )}
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Link
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-11 sm:size-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      onClick={() => handleDeleteItem(item)}
                      aria-label={`Remove ${item.name}`}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** Which of your wishlists this exchange shows, and a way to pick another. */
function WishlistInUse({
  current,
  choices,
  switching,
  onChoose,
}: {
  current: ExchangeWishlistRef;
  choices: Wishlist[];
  switching: boolean;
  onChoose: (wishlistId: number) => void;
}) {
  const options = choices.some((list) => list.id === current.id)
    ? choices.map((list) => ({ id: list.id, name: list.name }))
    : [{ id: current.id, name: current.name }, ...choices.map((list) => ({ id: list.id, name: list.name }))];

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/60 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
      <p className="break-words">
        This is your wishlist <strong>{current.name}</strong>. Anything you add here shows there too.{" "}
        <Link href={`/wishlists/${current.id}`} className="text-violet-600 underline dark:text-violet-400">
          Open in Wishlists
        </Link>
      </p>
      {options.length > 1 && (
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor="exchange-wishlist-choice" className="whitespace-nowrap">
            Use a different wishlist
          </Label>
          <select
            id="exchange-wishlist-choice"
            value={current.id}
            disabled={switching}
            onChange={(event) => onChoose(Number(event.target.value))}
            className="h-11 rounded-md border border-slate-200 bg-white px-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:h-9"
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

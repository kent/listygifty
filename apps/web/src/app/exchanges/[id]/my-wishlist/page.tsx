"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { giftExchangesService, wishlistItemsService, AUTH_ROUTES } from "@/services";
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
import { ArrowLeft, Plus, DollarSign, Trash2, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { GiftExchange, WishlistItem } from "@niftygifty/types";

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
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    link: "",
    price: "",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(AUTH_ROUTES.signIn);
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        const exchangeData = await giftExchangesService.getBySlug(slug);
        setExchange(exchangeData);

        if (exchangeData.my_participant) {
          const itemsData = await wishlistItemsService.getAll(
            exchangeData.id,
            exchangeData.my_participant.id
          );
          setItems(itemsData);
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, slug]);

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
          className="inline-flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to {exchange.name}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">My Wishlist</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Add items you would like to receive for {exchange.name}
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
                  <Label className="text-slate-700 dark:text-slate-300">Name *</Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="What would you like?"
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Description</Label>
                  <Textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Size, color, or other details..."
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Link</Label>
                  <Input
                    type="url"
                    value={newItem.link}
                    onChange={(e) => setNewItem({ ...newItem, link: e.target.value })}
                    placeholder="https://..."
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Approximate Price ($)</Label>
                  <Input
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
            {items.map((item) => (
              <Card key={item.id} className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {item.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="h-6 w-6 text-slate-400 dark:text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {item.price && (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <DollarSign className="h-3 w-3" />
                            {parseFloat(item.price).toFixed(2)}
                          </span>
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
                      size="sm"
                      variant="ghost"
                      className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                      onClick={() => handleDeleteItem(item)}
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

"use client";

import Link from "next/link";
import { wishlistsService } from "@/services";
import { useWorkspaceData } from "@/hooks";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ListTodo, Calendar, Gift, ChevronRight, Crown, Lock, Users, Link as LinkIcon, AlertCircle, RefreshCw } from "lucide-react";
import type { Wishlist } from "@niftygifty/types";

function getVisibilityIcon(visibility: string) {
  switch (visibility) {
    case "private":
      return <Lock className="h-3 w-3" />;
    case "workspace":
      return <Users className="h-3 w-3" />;
    case "shared":
      return <LinkIcon className="h-3 w-3" />;
    default:
      return <Lock className="h-3 w-3" />;
  }
}

function getVisibilityColor(visibility: string) {
  switch (visibility) {
    case "private":
      return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/50";
    case "workspace":
      return "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/50";
    case "shared":
      return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50";
    default:
      return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/50";
  }
}

function getVisibilityLabel(visibility: string) {
  switch (visibility) {
    case "private":
      return "Private";
    case "workspace":
      return "Team";
    case "shared":
      return "Shared";
    default:
      return visibility;
  }
}

function WishlistCard({ wishlist }: { wishlist: Wishlist }) {
  const date = wishlist.target_date ? new Date(wishlist.target_date) : null;
  const formattedDate = date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Link href={`/wishlists/${wishlist.id}`}>
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:border-violet-500/50 transition-all cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-2xl shrink-0">
              <ListTodo className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{wishlist.name}</h3>
                {wishlist.is_owner && (
                  <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                {!wishlist.is_owner && wishlist.owner && (
                  <span className="text-slate-600 dark:text-slate-300">
                    by {wishlist.owner.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  {wishlist.item_count} {wishlist.item_count === 1 ? "item" : "items"}
                </span>
                {wishlist.claimed_count > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    {wishlist.claimed_count} claimed
                  </span>
                )}
                {formattedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formattedDate}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={getVisibilityColor(wishlist.visibility)}>
                {getVisibilityIcon(wishlist.visibility)}
                <span className="ml-1 hidden sm:inline">{getVisibilityLabel(wishlist.visibility)}</span>
              </Badge>
              <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function WishlistsPage() {
  const {
    data: wishlists,
    isLoading,
    error,
    refetch,
    user,
    signOut,
  } = useWorkspaceData<Wishlist[]>({
    fetcher: () => wishlistsService.getAll(),
    initialData: [],
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <AppHeader user={user} onSignOut={signOut} />
        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Failed to load wishlists
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const myWishlists = wishlists.filter((w) => w.is_owner);
  const sharedWithMe = wishlists.filter((w) => !w.is_owner);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Wishlists</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Create wishlists and share them with friends and family
            </p>
          </div>
          <Link href="/wishlists/new">
            <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600">
              <Plus className="h-4 w-4 mr-2" />
              New Wishlist
            </Button>
          </Link>
        </div>

        {wishlists.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
            <ListTodo className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Wishlists Yet</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
              Create a wishlist to let others know what gifts you&apos;d love to receive. Share it via link and let people claim items to avoid duplicate gifts.
            </p>
            <Link href="/wishlists/new">
              <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Wishlist
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {myWishlists.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  My Wishlists
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myWishlists.map((wishlist) => (
                    <WishlistCard key={wishlist.id} wishlist={wishlist} />
                  ))}
                </div>
              </div>
            )}

            {sharedWithMe.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                  Shared with Me
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sharedWithMe.map((wishlist) => (
                    <WishlistCard key={wishlist.id} wishlist={wishlist} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

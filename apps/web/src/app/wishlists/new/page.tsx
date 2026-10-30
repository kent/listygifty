"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { wishlistsService } from "@/services";
import { useWorkspaceData } from "@/hooks";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Lock, Users, Link as LinkIcon, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { WishlistVisibility } from "@niftygifty/types";

export default function NewWishlistPage() {
  const router = useRouter();
  const { user, signOut, isLoading: authLoading } = useWorkspaceData({
    fetcher: async () => null,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<WishlistVisibility>("private");
  const [antiSpoilerEnabled, setAntiSpoilerEnabled] = useState(true);
  const [targetDate, setTargetDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a wishlist name");
      return;
    }

    setIsSubmitting(true);
    try {
      const wishlist = await wishlistsService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        anti_spoiler_enabled: antiSpoilerEnabled,
        target_date: targetDate || undefined,
      });

      toast.success("Wishlist created!");
      router.push(`/wishlists/${wishlist.id}`);
    } catch {
      toast.error("Failed to create wishlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-2xl">
        <Link
          href="/wishlists"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Wishlists
        </Link>

        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Wishlist</CardTitle>
            <CardDescription>
              Create a wishlist to share with friends and family
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Wishlist Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Birthday Wishlist, Holiday Gifts"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add a note for people viewing your wishlist..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-white dark:bg-slate-900 min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-date">Target Date (optional)</Label>
                <Input
                  id="target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-white dark:bg-slate-900"
                />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  When do you want to receive these gifts?
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as WishlistVisibility)}>
                  <SelectTrigger id="visibility" className="bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Private</div>
                          <div className="text-xs text-slate-600 dark:text-slate-500">Only you can see this wishlist</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="workspace">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Workspace</div>
                          <div className="text-xs text-slate-600 dark:text-slate-500">All workspace members can view and claim</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="shared">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Shared Link</div>
                          <div className="text-xs text-slate-600 dark:text-slate-500">Anyone with the link can view and claim</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <div className="flex items-center gap-3">
                  <EyeOff className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  <div>
                    <Label htmlFor="anti-spoiler" className="font-medium text-violet-900 dark:text-violet-100">
                      Anti-Spoiler Mode
                    </Label>
                    <p className="text-sm text-violet-600 dark:text-violet-400">
                      Hide who claimed which items until you reveal them
                    </p>
                  </div>
                </div>
                <Switch
                  id="anti-spoiler"
                  checked={antiSpoilerEnabled}
                  onCheckedChange={setAntiSpoilerEnabled}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/wishlists")}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Wishlist"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

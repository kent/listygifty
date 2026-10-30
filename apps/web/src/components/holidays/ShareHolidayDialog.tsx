"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check, RefreshCw, Users, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { holidaysService } from "@/services";
import type { Holiday, HolidayCollaborator } from "@niftygifty/types";

interface ShareHolidayDialogProps {
  holiday: Holiday;
  trigger?: React.ReactNode;
}

export function ShareHolidayDialog({ holiday, trigger }: ShareHolidayDialogProps) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<HolidayCollaborator[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const loadShareData = useCallback(async () => {
    setLoading(true);
    try {
      const [shareData, collabData] = await Promise.all([
        holidaysService.getShareLink(holiday.id),
        holidaysService.getCollaborators(holiday.id),
      ]);
      setShareUrl(shareData.share_url);
      setCollaborators(collabData);
    } catch (err) {
      console.error("Failed to load share data:", err);
    } finally {
      setLoading(false);
    }
  }, [holiday.id]);

  useEffect(() => {
    if (open) {
      loadShareData();
    }
  }, [open, loadShareData]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const data = await holidaysService.regenerateShareLink(holiday.id);
      setShareUrl(data.share_url);
    } catch (err) {
      console.error("Failed to regenerate link:", err);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRemoveCollaborator(userId: number) {
    try {
      await holidaysService.removeCollaborator(holiday.id, userId);
      setCollaborators((prev) => prev.filter((c) => c.user_id !== userId));
    } catch (err) {
      console.error("Failed to remove collaborator:", err);
    }
  }

  function getDisplayName(collab: HolidayCollaborator): string {
    if (collab.first_name || collab.last_name) {
      return [collab.first_name, collab.last_name].filter(Boolean).join(" ");
    }
    // Don't show weird clerk emails
    if (collab.email.includes("@clerk.user")) {
      return "Anonymous User";
    }
    return collab.email;
  }

  function getInitials(collab: HolidayCollaborator): string {
    if (collab.first_name) {
      const first = collab.first_name[0];
      const last = collab.last_name?.[0] || "";
      return (first + last).toUpperCase();
    }
    if (!collab.email.includes("@clerk.user")) {
      return collab.email[0].toUpperCase();
    }
    return "?";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">Share {holiday.name}</DialogTitle>
          <DialogDescription>
            Share this gift list with family or friends so they can add gifts and people.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Share Link */}
            <div className="space-y-2">
              <label htmlFor="share-link" className="text-sm font-medium text-muted-foreground">Share Link</label>
              <div className="flex gap-2">
                <Input
                  id="share-link"
                  value={shareUrl || ""}
                  readOnly
                  className="bg-muted border-border text-foreground"
                />
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={!shareUrl}
                  aria-label="Copy share link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-700 dark:text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleRegenerate}
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={regenerating}
                  aria-label="Regenerate share link"
                >
                  <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone with this link can join this gift list as a collaborator.
              </p>
            </div>

            {/* Collaborators */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Collaborators ({collaborators.length})</span>
              </div>
              {collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No collaborators yet. Share the link to invite people.
                </p>
              ) : (
                <ul className="space-y-2">
                  {collaborators.map((collab) => (
                    <li
                      key={collab.user_id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        {collab.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={collab.image_url}
                            alt={getDisplayName(collab)}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-medium text-violet-800 dark:text-violet-300">
                            {getInitials(collab)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-foreground">{getDisplayName(collab)}</p>
                          <p className="text-xs text-muted-foreground capitalize">{collab.role}</p>
                        </div>
                      </div>
                      {collab.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCollaborator(collab.user_id)}
                          aria-label={`Remove ${getDisplayName(collab)}`}
                          className="text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10"
                        >
                          Remove
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


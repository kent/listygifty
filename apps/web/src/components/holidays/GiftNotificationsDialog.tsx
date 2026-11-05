"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { holidaysService } from "@/services";
import { humanizeError } from "@/lib/error-message";
import type { GiftNotificationSetting, Holiday } from "@niftygifty/types";

export const GIFT_NOTIFICATION_OPTIONS: { value: GiftNotificationSetting; label: string; detail: string }[] = [
  { value: "instant", label: "Right away", detail: "Email me a few minutes after someone adds a gift" },
  { value: "daily", label: "Daily summary", detail: "Include new gifts in my daily email of list changes" },
  { value: "off", label: "Off", detail: "Don't email me about this list" },
];

interface GiftNotificationsDialogProps {
  holiday: Holiday;
  onUpdated: (holiday: Holiday) => void;
}

/** Your own setting for emails about gifts other people add to this list. */
export function GiftNotificationsDialog({ holiday, onUpdated }: GiftNotificationsDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<GiftNotificationSetting | null>(null);
  const current = holiday.gift_notifications ?? "instant";

  async function choose(value: GiftNotificationSetting) {
    if (value === current || saving) return;
    setSaving(value);
    try {
      onUpdated(await holidaysService.updateNotifications(holiday.id, value));
      toast.success("Notifications updated");
      setOpen(false);
    } catch (err) {
      toast.error(humanizeError(err, "Couldn't update notifications. Please try again."));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Notifications" className="gap-1.5 md:gap-2 flex-1 md:flex-none">
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Notifications</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New gift emails</DialogTitle>
          <DialogDescription>
            When someone else adds a gift to {holiday.name}. Only you see this setting.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="New gift emails" className="space-y-2">
          {GIFT_NOTIFICATION_OPTIONS.map((option) => {
            const selected = option.value === current;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving !== null}
                onClick={() => choose(option.value)}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{option.detail}</div>
                </div>
                {selected && <Check className="h-4 w-4 text-violet-500" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

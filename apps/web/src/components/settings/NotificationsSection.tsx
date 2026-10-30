"use client";

import { useState, useEffect, useCallback } from "react";
import { notificationPreferencesService } from "@/services";
import { Switch } from "@/components/ui/switch";
import { Bell, Gift, TreePine, Calendar, Loader2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import type { NotificationPreferences, EmailDeliverySummary } from "@niftygifty/types";

interface NotificationToggle {
  id: keyof Omit<NotificationPreferences, "created_at" | "updated_at">;
  title: string;
  description: string;
  icon: typeof Gift;
}

const NOTIFICATION_TOGGLES: NotificationToggle[] = [
  {
    id: "pending_gifts_reminder_enabled",
    title: "Pending Gifts Reminder",
    description: "Get reminders about gifts that aren't wrapped or done yet",
    icon: Gift,
  },
  {
    id: "no_gifts_before_christmas_enabled",
    title: "Christmas Gift Nudge",
    description: "Get reminded to add gifts if your Christmas list is empty",
    icon: TreePine,
  },
  {
    id: "no_gift_lists_december_enabled",
    title: "December Planning Reminder",
    description: "Weekly reminders in December if you haven't created a gift list",
    icon: Calendar,
  },
];

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [emailHistory, setEmailHistory] = useState<EmailDeliverySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [prefsData, historyData] = await Promise.all([
          notificationPreferencesService.get(),
          notificationPreferencesService.getEmailHistory(),
        ]);
        setPrefs(prefsData);
        setEmailHistory(historyData);
      } catch {
        toast.error("Failed to load notification settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = useCallback(
    async (id: NotificationToggle["id"], checked: boolean) => {
      if (!prefs) return;
      setUpdating(id);
      try {
        const updated = await notificationPreferencesService.update({ [id]: checked });
        setPrefs(updated);
        toast.success(checked ? "Notifications enabled" : "Notifications disabled");
      } catch {
        toast.error("Failed to update preference");
      } finally {
        setUpdating(null);
      }
    },
    [prefs]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Bell className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Control what emails you receive from Listy Gifty
            </p>
          </div>
        </div>
      </div>

      {/* Notification Toggles */}
      <div className="space-y-4">
        {NOTIFICATION_TOGGLES.map(({ id, title, description, icon: Icon }) => (
          <div
            key={id}
            className="group relative rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700/50 hover:shadow-lg hover:shadow-violet-500/5"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 dark:from-slate-800 to-slate-50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shrink-0">
                  <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">{title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {updating === id && (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  )}
                  <Switch
                    checked={prefs?.[id] ?? true}
                    onCheckedChange={(checked) => handleToggle(id, checked)}
                    disabled={updating !== null}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-600 data-[state=checked]:to-fuchsia-600"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Email History */}
      {emailHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Recent Emails
            </h3>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden">
            <div className="divide-y divide-slate-200 dark:divide-slate-800/50">
              {emailHistory.slice(0, 5).map((email, idx) => (
                <div key={idx} className="p-4 flex items-center gap-4">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                      email.status === "sent"
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <Mail
                      className={`h-4 w-4 ${
                        email.status === "sent" ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {email.subject}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500">
                      <Clock className="h-3 w-3" />
                      {new Date(email.sent_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


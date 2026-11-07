"use client";

import { parseCalendarDate } from "@/lib/dates";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  giftExchangesService,
  exchangeParticipantsService,
  exchangeExclusionsService,
  exchangeNotificationsService,
} from "@/services";
import { ApiError } from "@/lib/api-client";
import { humanizeError } from "@/lib/error-message";
import { signInUrlForCurrentPage } from "@/lib/sign-in-redirect";
import { AppHeader } from "@/components/layout";
import { getExchangeNextStep } from "@/components/exchanges/exchange-next-step";
import { MatchOverviewCard } from "@/components/exchanges/match-overview-card";
import { NudgeParticipantDialog } from "@/components/exchanges/nudge-participant-dialog";
import { formatPhone } from "@/lib/phone";
import { pluralize } from "@/components/exchanges/pluralize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Users,
  Plus,
  Send,
  Play,
  Check,
  Copy,
  Clock,
  X,
  Ban,
  Trash2,
  List,
  Bell,
  RotateCcw,
  Shuffle,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";
import type {
  GiftExchangeWithParticipants,
  ExchangeParticipant,
  ExchangeExclusion,
  ExchangeNotification,
} from "@niftygifty/types";

// Dark enough for white text in both themes.
const PUBLISH_BUTTON =
  "bg-gradient-to-r from-green-800 to-emerald-800 hover:from-green-900 hover:to-emerald-900 dark:from-green-700 dark:to-emerald-700 dark:hover:from-green-800 dark:hover:to-emerald-800";

// Tap targets are 44px on phones and stay compact from the sm breakpoint up.
const CARD_ACTION_CLASS = "h-11 sm:h-8 border-slate-200 dark:border-slate-700";
const ROW_ICON_BUTTON_CLASS = "size-11 sm:size-8";
const ROW_REMOVE_BUTTON_CLASS = `${ROW_ICON_BUTTON_CLASS} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300`;

function getStatusIcon(status: string) {
  switch (status) {
    case "accepted":
      return <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />;
    case "declined":
      return <X className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />;
    default:
      return <Clock className="h-4 w-4 shrink-0 text-amber-800 dark:text-amber-400" />;
  }
}

function getParticipantStatusLabel(status: ExchangeParticipant["status"]) {
  switch (status) {
    case "accepted":
      return "Joined";
    case "declined":
      return "Declined";
    default:
      return "Needs to join";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "draft":
      return "bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/50";
    case "inviting":
      return "bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500/50";
    case "active":
      return "bg-green-500/20 text-green-800 dark:text-green-400 border-green-500/50";
    case "completed":
      return "bg-violet-500/20 text-violet-700 dark:text-violet-400 border-violet-500/50";
    default:
      return "bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/50";
  }
}

const EXCHANGE_REFRESH_MS = 15_000;

export default function ExchangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = use(params);
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const router = useRouter();
  const [exchange, setExchange] = useState<GiftExchangeWithParticipants | null>(null);
  const [exclusions, setExclusions] = useState<ExchangeExclusion[]>([]);
  const [notifications, setNotifications] = useState<ExchangeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"not-found" | "load-failed" | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showExclusionDialog, setShowExclusionDialog] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showRedoDialog, setShowRedoDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [redoingMode, setRedoingMode] = useState<"reopen" | "redraw" | null>(null);
  const [participantToRemove, setParticipantToRemove] = useState<ExchangeParticipant | null>(null);
  const [participantToNudge, setParticipantToNudge] = useState<ExchangeParticipant | null>(null);
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" });
  const [newExclusion, setNewExclusion] = useState({ participant_a_id: "", participant_b_id: "" });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(signInUrlForCurrentPage());
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        const exchangeData = await giftExchangesService.getBySlug(slug);
        const exclusionsData = exchangeData.is_owner
          ? await exchangeExclusionsService.getAll(exchangeData.id).catch(() => [])
          : [];
        const notificationsData = exchangeData.my_participant
          ? await exchangeNotificationsService.getAll(exchangeData.id).catch(() => [])
          : [];
        setExchange(exchangeData);
        setExclusions(exclusionsData);
        setNotifications(notificationsData);
      } catch (err: unknown) {
        setLoadError(err instanceof ApiError && err.isNotFound ? "not-found" : "load-failed");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, slug, loadAttempt]);

  const handleRetryLoad = () => {
    setLoadError(null);
    setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const refreshExchange = useCallback(async () => {
    try {
      setExchange(await giftExchangesService.getBySlug(slug));
    } catch {
      // The change itself saved, so keep what's on screen until the next load.
    }
  }, [slug]);

  // Other people join while this tab sits in the background.
  useEffect(() => {
    if (!isAuthenticated) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshExchange();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isAuthenticated, refreshExchange]);

  // Until names are drawn, a page left in view should still show who has joined.
  const waitingForDraw = exchange?.status === "draft" || exchange?.status === "inviting";
  useEffect(() => {
    if (!isAuthenticated || !waitingForDraw) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshExchange();
    }, EXCHANGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, waitingForDraw, refreshExchange]);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipant.name.trim() || !newParticipant.email.trim()) return;

    setAddingParticipant(true);
    try {
      if (!exchange) return;
      const participant = await exchangeParticipantsService.create(exchange.id, {
        name: newParticipant.name.trim(),
        email: newParticipant.email.trim(),
      });
      setExchange((prev) =>
        prev
          ? {
              ...prev,
              exchange_participants: [...prev.exchange_participants, participant],
              participant_count: prev.participant_count + 1,
            }
          : prev
      );
      setNewParticipant({ name: "", email: "" });
      setShowAddDialog(false);
      toast.success(`Invited ${participant.name}`);
      await refreshExchange();
    } catch (err: unknown) {
      toast.error(humanizeError(err, "Failed to add participant"));
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleResendInvite = async (participant: ExchangeParticipant) => {
    try {
      if (!exchange) return;
      await exchangeParticipantsService.resendInvite(exchange.id, participant.id);
      toast.success(`Invitation resent to ${participant.email}`);
      await refreshExchange();
    } catch {
      toast.error("Failed to resend invitation");
    }
  };

  const handleNudged = (nudged: ExchangeParticipant) => {
    setExchange((prev) =>
      prev
        ? {
            ...prev,
            exchange_participants: prev.exchange_participants.map((participant) =>
              participant.id === nudged.id ? { ...participant, ...nudged } : participant
            ),
          }
        : prev
    );
  };

  const handleCopyInvite = async (participant: ExchangeParticipant) => {
    if (!participant.invite_token) return;

    const inviteUrl = `${window.location.origin}/join/exchange/${participant.invite_token}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success(`Invite link copied for ${participant.name}`);
  };

  const handleCopyJoinLink = async () => {
    if (!exchange?.share_url) return;

    await navigator.clipboard.writeText(exchange.share_url);
    toast.success("Join link copied. Drop it in the group chat.");
  };

  const handleRemoveParticipant = async (participant: ExchangeParticipant) => {
    try {
      if (!exchange) return;
      await exchangeParticipantsService.delete(exchange.id, participant.id);
      setExchange((prev) =>
        prev
          ? {
              ...prev,
              exchange_participants: prev.exchange_participants.filter((p) => p.id !== participant.id),
              participant_count: prev.participant_count - 1,
            }
          : prev
      );
      // The API deletes a person's rules along with them.
      setExclusions((prev) =>
        prev.filter(
          (e) => e.participant_a_id !== participant.id && e.participant_b_id !== participant.id
        )
      );
      toast.success(`Removed ${participant.name}`);
      await refreshExchange();
    } catch {
      toast.error("Failed to remove participant");
    }
  };

  const handleAddExclusion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExclusion.participant_a_id || !newExclusion.participant_b_id) return;

    try {
      if (!exchange) return;
      const exclusion = await exchangeExclusionsService.create(exchange.id, {
        participant_a_id: parseInt(newExclusion.participant_a_id),
        participant_b_id: parseInt(newExclusion.participant_b_id),
      });
      setExclusions((prev) => [...prev, exclusion]);
      setNewExclusion({ participant_a_id: "", participant_b_id: "" });
      setShowExclusionDialog(false);
      toast.success("Exclusion rule added");
    } catch {
      toast.error("Failed to add exclusion rule");
    }
  };

  const handleRemoveExclusion = async (exclusion: ExchangeExclusion) => {
    try {
      if (!exchange) return;
      await exchangeExclusionsService.delete(exchange.id, exclusion.id);
      setExclusions((prev) => prev.filter((e) => e.id !== exclusion.id));
      toast.success("Exclusion rule removed");
    } catch {
      toast.error("Failed to remove exclusion rule");
    }
  };

  const handleStartExchange = async () => {
    setStarting(true);
    try {
      if (!exchange) return;
      const updated = await giftExchangesService.publish(exchange.id);
      setExchange(updated);
      setShowStartDialog(false);
      toast.success("Names drawn! Everyone has been emailed to see who they got.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to draw names";
      toast.error(message);
    } finally {
      setStarting(false);
    }
  };

  const handleRedoExchange = async (mode: "reopen" | "redraw") => {
    setRedoingMode(mode);
    try {
      if (!exchange) return;
      const updated = await giftExchangesService.redo(exchange.id, mode);
      setExchange(updated);
      setNotifications([]);
      setShowRedoDialog(false);
      toast.success(
        mode === "reopen"
          ? "Exchange reopened. Make your changes, then draw names when you’re ready."
          : "Names redrawn. Everyone has a new match and a fresh email."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not redo the exchange";
      toast.error(message);
    } finally {
      setRedoingMode(null);
    }
  };

  const handleDeleteExchange = async () => {
    if (!exchange) return;
    setDeleting(true);
    try {
      await giftExchangesService.delete(exchange.id);
      toast.success(`Deleted ${exchange.name}`);
      router.push("/exchanges");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete exchange";
      toast.error(message);
      setDeleting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError === "load-failed") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">
            We couldn&apos;t load this exchange. Check your connection and try again.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleRetryLoad}>Try again</Button>
            <Link href="/exchanges">
              <Button variant="outline">Back to Exchanges</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadError === "not-found" || !exchange) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Exchange not found</p>
          <Link href="/exchanges">
            <Button className="mt-4">Back to Exchanges</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = exchange.is_owner;
  const participants = exchange.exchange_participants || [];
  const myParticipant = exchange.my_participant;
  const nextStep = getExchangeNextStep({ ...exchange, exchange_participants: participants });
  const pendingCount = participants.filter((p) => p.status === "invited").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <Link
          href="/exchanges"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Exchanges
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <h1 className="min-w-0 break-words text-3xl font-bold text-slate-900 dark:text-white">{exchange.name}</h1>
              <Badge variant="outline" className={`capitalize ${getStatusColor(exchange.status)}`}>
                {exchange.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
              {exchange.exchange_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {parseCalendarDate(exchange.exchange_date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
              {(exchange.budget_min || exchange.budget_max) && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {exchange.budget_min && exchange.budget_max
                    ? `$${parseFloat(exchange.budget_min).toFixed(0)} - $${parseFloat(exchange.budget_max).toFixed(0)}`
                    : exchange.budget_max
                    ? `Up to $${parseFloat(exchange.budget_max).toFixed(0)}`
                    : `At least $${parseFloat(exchange.budget_min!).toFixed(0)}`}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {exchange.accepted_count}/{exchange.participant_count} joined
              </span>
            </div>
            {nextStep && (
              <p
                data-testid="exchange-next-step"
                className="mt-3 text-sm text-slate-600 dark:text-slate-300"
              >
                {nextStep}
              </p>
            )}
          </div>

          {isOwner && exchange.can_start && (
            <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
              <DialogTrigger asChild>
                <Button className={PUBLISH_BUTTON}>
                  <Play className="h-4 w-4 mr-2" />
                  Draw names
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-white">Draw names?</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <DialogDescription className="text-slate-600 dark:text-slate-400">
                    This will match all joined participants and email them to sign in and privately
                    reveal their assignments. Pending invitations will be closed. You can redo the
                    draw later, but everyone will get a new match and a new email.
                  </DialogDescription>
                  <div className="mt-4 p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-900 dark:text-white font-medium mb-2">Ready to draw:</p>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <li>• {pluralize(exchange.accepted_count, "joined participant")}</li>
                      <li>• {pluralize(pendingCount, "pending invitation")} will close</li>
                      <li>• {pluralize(exclusions.length, "exclusion rule")}</li>
                    </ul>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowStartDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartExchange}
                    disabled={starting}
                    className={PUBLISH_BUTTON}
                  >
                    {starting ? "Drawing..." : "Draw names"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {exchange.capabilities.redo && (
            <Dialog open={showRedoDialog} onOpenChange={setShowRedoDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-violet-400/40">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Redo exchange
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-white">
                    How do you want to redo it?
                  </DialogTitle>
                </DialogHeader>
                <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                  The current matches will stop being valid. Choose whether you need to make changes
                  first or simply draw a fresh set of names.
                </DialogDescription>
                <div className="grid gap-3 py-2">
                  <button
                    type="button"
                    data-testid="reopen-exchange"
                    className="rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-violet-400 hover:bg-violet-500/5 disabled:opacity-50 dark:border-slate-700"
                    onClick={() => handleRedoExchange("reopen")}
                    disabled={redoingMode !== null}
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                      <RotateCcw className="h-4 w-4 text-violet-500" />
                      {redoingMode === "reopen" ? "Reopening…" : "Reopen and edit"}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
                      Keep joined people accepted, reopen unused invites, and clear the old matches.
                      You can add people or change the exclusion rules before drawing names again.
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="redraw-exchange"
                    className="rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-fuchsia-400 hover:bg-fuchsia-500/5 disabled:opacity-50 dark:border-slate-700"
                    onClick={() => handleRedoExchange("redraw")}
                    disabled={redoingMode !== null}
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                      <Shuffle className="h-4 w-4 text-fuchsia-500" />
                      {redoingMode === "redraw" ? "Redrawing…" : "Redraw names now"}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
                      Keep this roster and these rules, give everyone a different recipient, and send
                      fresh match emails right away.
                    </span>
                  </button>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setShowRedoDialog(false)}
                    disabled={redoingMode !== null}
                  >
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {exchange.capabilities.delete && (
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  data-testid="delete-exchange"
                  className="border-red-400/40 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete exchange
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-white">
                    Delete {exchange.name}?
                  </DialogTitle>
                  <DialogDescription>This permanently removes the exchange and its participant access.</DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  {exchange.status === "inviting" || exchange.status === "active" ? (
                    <>
                      <p className="text-slate-600 dark:text-slate-400">
                        This exchange is {exchange.status === "active" ? "active" : "still inviting people"},
                        so deleting it has real consequences:
                      </p>
                      <div className="mt-4 p-4 rounded-lg bg-red-500/5 border border-red-400/30">
                        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                          {exchange.status === "active" && (
                            <li>• Everyone&apos;s match is destroyed, along with exchange wishlists</li>
                          )}
                          <li>• {exchange.participant_count} participant{exchange.participant_count === 1 ? "" : "s"} lose access and pending invite links stop working</li>
                          <li>• Participants will be emailed that the exchange was cancelled</li>
                          <li>• This cannot be undone</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400">
                      This permanently removes the exchange{exchange.status === "completed" ? " and its history" : ""}. This cannot be undone.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteExchange}
                    disabled={deleting}
                    data-testid="confirm-delete-exchange"
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {deleting ? "Deleting…" : "Delete exchange"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {myParticipant?.matched_participant &&
          (exchange.status === "active" || exchange.status === "completed") && (
            <MatchOverviewCard
              match={myParticipant.matched_participant}
              exchangeSlug={slug}
            />
          )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Participants */}
          <Card
            data-testid="participant-roster"
            className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
          >
            <CardHeader className="flex flex-row flex-wrap items-center justify-between">
              <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                Participants
              </CardTitle>
              {isOwner && exchange.status !== "active" && exchange.status !== "completed" && (
                <div className="flex flex-wrap items-center gap-2">
                  {exchange.share_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={CARD_ACTION_CLASS}
                      onClick={handleCopyJoinLink}
                      data-testid="copy-join-link"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy join link
                    </Button>
                  )}
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className={CARD_ACTION_CLASS}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                      <DialogTitle className="text-slate-900 dark:text-white">Add Participant</DialogTitle>
                      <DialogDescription>Send an email invitation to join this gift exchange.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddParticipant} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="participant-name" className="text-slate-700 dark:text-slate-300">Name</Label>
                        <Input
                          id="participant-name"
                          value={newParticipant.name}
                          onChange={(e) =>
                            setNewParticipant({ ...newParticipant, name: e.target.value })
                          }
                          placeholder="John Doe"
                          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="participant-email" className="text-slate-700 dark:text-slate-300">Email</Label>
                        <Input
                          id="participant-email"
                          type="email"
                          value={newParticipant.email}
                          onChange={(e) =>
                            setNewParticipant({ ...newParticipant, email: e.target.value })
                          }
                          placeholder="john@example.com"
                          className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setShowAddDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={addingParticipant}>
                          {addingParticipant ? "Adding..." : "Add & Invite"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-400 text-center py-8">
                  No participants yet. Add people to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex min-w-0 grow basis-40 items-center gap-3">
                        {getStatusIcon(participant.status)}
                        <div className="min-w-0">
                          <p className="break-words text-slate-900 dark:text-white font-medium">{participant.display_name}</p>
                          {participant.email && (
                            <p className="break-words text-xs text-slate-600 dark:text-slate-400">{participant.email}</p>
                          )}
                          {participant.phone && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">{formatPhone(participant.phone)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            participant.status === "accepted"
                              ? "border-green-500/40 text-green-800 dark:text-green-400"
                              : participant.status === "declined"
                                ? "border-red-500/40 text-red-700 dark:text-red-400"
                                : "border-amber-500/40 text-amber-800 dark:text-amber-400"
                          }
                        >
                          {getParticipantStatusLabel(participant.status)}
                        </Badge>
                        {participant.wishlist_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {pluralize(participant.wishlist_count, "item")}
                          </Badge>
                        )}
                        {isOwner && participant.status === "invited" && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className={ROW_ICON_BUTTON_CLASS}
                            onClick={() => handleCopyInvite(participant)}
                            aria-label={`Copy invite for ${participant.display_name}`}
                            title="Copy invite"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                        {isOwner && participant.status === "invited" && exchange.status !== "active" && exchange.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={CARD_ACTION_CLASS}
                            onClick={() => setParticipantToNudge(participant)}
                            disabled={!participant.can_nudge}
                            aria-label={participant.can_nudge ? `Nudge ${participant.display_name}` : `Nudged ${participant.display_name} in the last day`}
                            title={participant.can_nudge ? "Remind them by email or text" : "You can nudge them again a day after the last nudge"}
                          >
                            <BellRing className="h-3 w-3 mr-1" />
                            {participant.can_nudge ? "Nudge" : "Nudged"}
                          </Button>
                        )}
                        {isOwner && participant.status === "declined" && exchange.status !== "active" && exchange.status !== "completed" && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className={ROW_ICON_BUTTON_CLASS}
                            onClick={() => handleResendInvite(participant)}
                            aria-label={`Resend invite to ${participant.display_name}`}
                            title="Resend invite"
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                        {isOwner && exchange.status !== "active" && exchange.status !== "completed" && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className={ROW_REMOVE_BUTTON_CLASS}
                            onClick={() => setParticipantToRemove(participant)}
                            aria-label={`Remove ${participant.display_name}`}
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exclusion Rules */}
          {isOwner && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between">
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                  <Ban className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  Exclusion Rules
                </CardTitle>
                {exchange.status !== "active" && exchange.status !== "completed" && participants.length >= 2 && (
                  <Dialog open={showExclusionDialog} onOpenChange={setShowExclusionDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className={CARD_ACTION_CLASS}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Rule
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">Add Exclusion Rule</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddExclusion} className="space-y-4">
                        <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                          These two people will not be matched with each other.
                        </DialogDescription>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="exclusion-person-1" className="text-slate-700 dark:text-slate-300">Person 1</Label>
                            <Select
                              value={newExclusion.participant_a_id}
                              onValueChange={(v) =>
                                setNewExclusion({ ...newExclusion, participant_a_id: v })
                              }
                            >
                              <SelectTrigger id="exclusion-person-1" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {participants.map((p) => (
                                  <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.display_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="exclusion-person-2" className="text-slate-700 dark:text-slate-300">Person 2</Label>
                            <Select
                              value={newExclusion.participant_b_id}
                              onValueChange={(v) =>
                                setNewExclusion({ ...newExclusion, participant_b_id: v })
                              }
                            >
                              <SelectTrigger id="exclusion-person-2" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {participants
                                  .filter((p) => p.id.toString() !== newExclusion.participant_a_id)
                                  .map((p) => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                      {p.display_name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowExclusionDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={!newExclusion.participant_a_id || !newExclusion.participant_b_id}
                          >
                            Add Rule
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {exclusions.length === 0 ? (
                  <p className="text-slate-600 dark:text-slate-400 text-center py-8">
                    No exclusion rules. Everyone can be matched with anyone.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {exclusions.map((exclusion) => (
                      <div
                        key={exclusion.id}
                        className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="min-w-0 break-words text-slate-900 dark:text-white">{exclusion.participant_a.name}</span>
                          <Ban className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                          <span className="min-w-0 break-words text-slate-900 dark:text-white">{exclusion.participant_b.name}</span>
                        </div>
                        {exchange.status !== "active" && exchange.status !== "completed" && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className={ROW_REMOVE_BUTTON_CLASS}
                            onClick={() => handleRemoveExclusion(exclusion)}
                            aria-label={`Remove rule between ${exclusion.participant_a.name} and ${exclusion.participant_b.name}`}
                            title="Remove rule"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {myParticipant && notifications.length > 0 && (
            <Card
              data-testid="exchange-notifications"
              className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
            >
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                  Notifications
                  {notifications.some((notification) => !notification.read_at) && (
                    <Badge>New</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className="w-full text-left p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                    onClick={async () => {
                      if (notification.read_at) return;
                      const updated = await exchangeNotificationsService.markRead(
                        exchange.id,
                        notification.id
                      );
                      setNotifications((current) =>
                        current.map((item) => (item.id === updated.id ? updated : item))
                      );
                    }}
                  >
                    <span className={notification.read_at ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"}>
                      {notification.message}
                    </span>
                    {!notification.read_at && (
                      <span className="ml-2 text-xs text-violet-700 dark:text-violet-300">Mark read</span>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Anyone who has joined can work on their wishlist, draw or no draw */}
          {myParticipant?.status === "accepted" && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                  <List className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                  My Wishlist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-900 dark:text-white">
                    {pluralize(myParticipant.wishlist_count, "item")}
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full border-slate-200 dark:border-slate-700">
                  <Link href={`/exchanges/${slug}/my-wishlist`}>
                    <List className="h-4 w-4 mr-2" />
                    Edit Wishlist
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {isOwner && (
          <NudgeParticipantDialog
            exchangeId={exchange.id}
            participant={participantToNudge}
            onClose={() => setParticipantToNudge(null)}
            onNudged={handleNudged}
          />
        )}

        {participantToRemove && (
          <AlertDialog
            open
            onOpenChange={(open) => {
              if (!open) setParticipantToRemove(null);
            }}
          >
            <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="[overflow-wrap:anywhere] text-slate-900 dark:text-white">
                  Remove {participantToRemove.display_name} from {exchange.name}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                  They&apos;ll lose their spot and their invite link, along with their wishlist and
                  any exclusion rules that include them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11 sm:h-9">Keep them</AlertDialogCancel>
                <AlertDialogAction
                  className="h-11 sm:h-9 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleRemoveParticipant(participantToRemove)}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </main>
    </div>
  );
}

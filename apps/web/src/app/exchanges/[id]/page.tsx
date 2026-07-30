"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  giftExchangesService,
  exchangeParticipantsService,
  exchangeExclusionsService,
  exchangeNotificationsService,
  AUTH_ROUTES,
} from "@/services";
import { AppHeader } from "@/components/layout";
import { MatchOverviewCard } from "@/components/exchanges/match-overview-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import type {
  GiftExchangeWithParticipants,
  ExchangeParticipant,
  ExchangeExclusion,
  ExchangeNotification,
} from "@niftygifty/types";

function getStatusIcon(status: string) {
  switch (status) {
    case "accepted":
      return <Check className="h-4 w-4 text-green-400" />;
    case "declined":
      return <X className="h-4 w-4 text-red-400" />;
    default:
      return <Clock className="h-4 w-4 text-amber-400" />;
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
      return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/50";
    case "inviting":
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50";
    case "active":
      return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50";
    case "completed":
      return "bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/50";
    default:
      return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/50";
  }
}

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
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showExclusionDialog, setShowExclusionDialog] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [starting, setStarting] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" });
  const [newExclusion, setNewExclusion] = useState({ participant_a_id: "", participant_b_id: "" });

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
        const exclusionsData = await exchangeExclusionsService.getAll(exchangeData.id).catch(() => []);
        const notificationsData = exchangeData.my_participant
          ? await exchangeNotificationsService.getAll(exchangeData.id).catch(() => [])
          : [];
        setExchange(exchangeData);
        setExclusions(exclusionsData);
        setNotifications(notificationsData);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, slug]);

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
    } catch {
      toast.error("Failed to add participant");
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleResendInvite = async (participant: ExchangeParticipant) => {
    try {
      if (!exchange) return;
      await exchangeParticipantsService.resendInvite(exchange.id, participant.id);
      toast.success(`Invitation resent to ${participant.email}`);
    } catch {
      toast.error("Failed to resend invitation");
    }
  };

  const handleCopyInvite = async (participant: ExchangeParticipant) => {
    if (!participant.invite_token) return;

    const inviteUrl = `${window.location.origin}/join/exchange/${participant.invite_token}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success(`Invite link copied for ${participant.name}`);
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
      toast.success(`Removed ${participant.name}`);
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
      toast.success("Exchange published! Participants have been emailed to reveal their matches.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to publish exchange";
      toast.error(message);
    } finally {
      setStarting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!exchange) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/5 dark:from-violet-900/10 via-transparent to-transparent" />

      <AppHeader user={user} onSignOut={signOut} />

      <main className="relative z-10 container mx-auto px-4 py-8">
        <Link
          href="/exchanges"
          className="inline-flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Exchanges
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{exchange.name}</h1>
              <Badge variant="outline" className={getStatusColor(exchange.status)}>
                {exchange.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              {exchange.exchange_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(exchange.exchange_date).toLocaleDateString("en-US", {
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
          </div>

          {isOwner && exchange.can_start && (
            <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                  <Play className="h-4 w-4 mr-2" />
                  Publish Exchange
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-white">Publish Gift Exchange?</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-slate-600 dark:text-slate-400">
                    This will match all joined participants and email them to sign in and privately
                    reveal their assignments. Pending invitations will be closed. This action cannot
                    be undone.
                  </p>
                  <div className="mt-4 p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-900 dark:text-white font-medium mb-2">Ready to publish:</p>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <li>• {exchange.accepted_count} joined participants</li>
                      <li>• {exchange.participant_count - exchange.accepted_count} pending invitations will close</li>
                      <li>• {exclusions.length} exclusion rules</li>
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
                    className="bg-gradient-to-r from-green-500 to-emerald-500"
                  >
                    {starting ? "Publishing..." : "Publish Exchange"}
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Participants */}
          <Card
            data-testid="participant-roster"
            className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                Participants
              </CardTitle>
              {isOwner && exchange.status !== "active" && exchange.status !== "completed" && (
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="border-slate-200 dark:border-slate-700">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                      <DialogTitle className="text-slate-900 dark:text-white">Add Participant</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddParticipant} className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 dark:text-slate-300">Name</Label>
                        <Input
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
                        <Label className="text-slate-700 dark:text-slate-300">Email</Label>
                        <Input
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
              )}
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No participants yet. Add people to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(participant.status)}
                        <div>
                          <p className="text-slate-900 dark:text-white font-medium">{participant.display_name}</p>
                          {participant.email && (
                            <p className="text-xs text-slate-500">{participant.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            participant.status === "accepted"
                              ? "border-green-500/40 text-green-600 dark:text-green-400"
                              : participant.status === "declined"
                                ? "border-red-500/40 text-red-600 dark:text-red-400"
                                : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                          }
                        >
                          {getParticipantStatusLabel(participant.status)}
                        </Badge>
                        {participant.wishlist_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {participant.wishlist_count} items
                          </Badge>
                        )}
                        {isOwner && participant.status === "invited" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyInvite(participant)}
                            aria-label={`Copy invite for ${participant.display_name}`}
                            title="Copy invite"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                        {isOwner && participant.status === "invited" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResendInvite(participant)}
                            title="Resend invite"
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                        {isOwner && exchange.status !== "active" && exchange.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => handleRemoveParticipant(participant)}
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                  <Ban className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  Exclusion Rules
                </CardTitle>
                {exchange.status !== "active" && exchange.status !== "completed" && participants.length >= 2 && (
                  <Dialog open={showExclusionDialog} onOpenChange={setShowExclusionDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="border-slate-200 dark:border-slate-700">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Rule
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">Add Exclusion Rule</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddExclusion} className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          These two people will not be matched with each other.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300">Person 1</Label>
                            <Select
                              value={newExclusion.participant_a_id}
                              onValueChange={(v) =>
                                setNewExclusion({ ...newExclusion, participant_a_id: v })
                              }
                            >
                              <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
                            <Label className="text-slate-700 dark:text-slate-300">Person 2</Label>
                            <Select
                              value={newExclusion.participant_b_id}
                              onValueChange={(v) =>
                                setNewExclusion({ ...newExclusion, participant_b_id: v })
                              }
                            >
                              <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
                  <p className="text-slate-500 text-center py-8">
                    No exclusion rules. Everyone can be matched with anyone.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {exclusions.map((exclusion) => (
                      <div
                        key={exclusion.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-900 dark:text-white">{exclusion.participant_a.name}</span>
                          <Ban className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                          <span className="text-slate-900 dark:text-white">{exclusion.participant_b.name}</span>
                        </div>
                        {exchange.status !== "active" && exchange.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => handleRemoveExclusion(exclusion)}
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
                    <span className={notification.read_at ? "text-slate-500" : "text-slate-900 dark:text-white"}>
                      {notification.message}
                    </span>
                    {!notification.read_at && (
                      <span className="ml-2 text-xs text-violet-500">Mark read</span>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Participant View - My Info */}
          {!isOwner && myParticipant && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                  <List className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                  {exchange.status === "active" || exchange.status === "completed"
                    ? "My Wishlist"
                    : "My Participation"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {exchange.status !== "active" && exchange.status !== "completed" && (
                  <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(myParticipant.status)}
                      <span className="text-slate-900 dark:text-white capitalize">{myParticipant.status}</span>
                    </div>
                  </div>
                )}
                <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">My Wishlist</p>
                  <p className="text-slate-900 dark:text-white">
                    {myParticipant.wishlist_count} items
                  </p>
                </div>
                {(exchange.status === "active" || exchange.status === "completed") && (
                  <Link href={`/exchanges/${slug}/my-wishlist`}>
                    <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700">
                      <List className="h-4 w-4 mr-2" />
                      Edit Wishlist
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

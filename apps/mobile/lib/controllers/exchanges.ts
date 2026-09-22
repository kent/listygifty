import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useAnalytics } from "@/lib/analytics";
import { haptics } from "@/lib/haptics";
import { runtimeConfig } from "@/lib/runtime-config";
import { useServices } from "@/lib/use-api";
import { useScreenActivity } from "@/lib/controllers/use-screen-activity";
import { useFocusResource } from "@/lib/controllers/use-focus-resource";
import { scheduleExchangeReminder } from "@/lib/notifications";
import { humanizeError } from "@/lib/error-message";
import { normalizeAuthReturnPath } from "@/lib/auth-return";
import {
  buildCreateExchangePayload,
  buildCreateExchangeExclusionPayload,
  buildCreateExchangeParticipantPayload,
  buildExchangeInviteUrl,
  buildCreateWishlistItemPayload,
  buildRepeatWishlistItemFormValues,
  buildFamilyExchangeFormValues,
  canScheduleExchangeReminder,
  canStartExchange,
  EMPTY_EXCHANGE_EXCLUSION_FORM_VALUES,
  EMPTY_EXCHANGE_PARTICIPANT_FORM_VALUES,
  buildExchangeSections,
  EMPTY_EXCHANGE_FORM_VALUES,
  EMPTY_WISHLIST_ITEM_FORM_VALUES,
  getExchangeDrawConfirmation,
  getExchangeReadinessItems,
  getExchangeStartBlocker,
  hasExchangeExclusionBetween,
  isValidIsoDate,
  parseOptionalDecimal,
  type ExchangeExclusion,
  type ExchangeExclusionFormValues,
  type ExchangeParticipantFormValues,
  type ExchangeFormValues,
  type ExchangeInviteDetails,
  type ExchangeJoinDetails,
  type ExchangeParticipant,
  type GiftExchange,
  type GiftExchangeWithParticipants,
  type WishlistItem,
  type WishlistItemFormValues,
} from "@/lib/models";

type ExchangeWishlistState = {
  exchange: GiftExchangeWithParticipants | null;
  items: WishlistItem[];
};

type ExchangeMatchState = {
  exchange: GiftExchangeWithParticipants | null;
  matchWishlist: WishlistItem[];
};

type WishlistItemSaveMode = "done" | "another";

export function useExchangesController() {
  const router = useRouter();
  const { giftExchanges } = useServices();
  const resource = useFocusResource<GiftExchange[]>({
    errorMessage: "Failed to load exchanges",
    initialValue: [] as GiftExchange[],
    load: () => giftExchanges.getAll(),
  });

  const sections = useMemo(() => buildExchangeSections(resource.data), [resource.data]);

  return {
    error: resource.error,
    handlePressExchange: (exchangeId: number) => router.push(`/(tabs)/exchanges/${exchangeId}`),
    loading: resource.loading,
    openNewExchange: () => router.push("/(tabs)/exchanges/new"),
    refreshing: resource.refreshing,
    retryLoad: resource.reload,
    sections,
    totalExchanges: resource.data.length,
    triggerRefresh: resource.refresh,
  };
}

export function useNewExchangeController() {
  const router = useRouter();
  const captureScreen = useScreenActivity();
  const { giftExchanges } = useServices();
  const track = useAnalytics();
  const [form, setForm] = useState<ExchangeFormValues>(() => buildFamilyExchangeFormValues());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback((field: keyof ExchangeFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const updateIncludeCreator = useCallback((value: boolean) => {
    setForm((current) => ({ ...current, includeCreator: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const isCurrentScreen = captureScreen();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (form.exchangeDate.trim() && !isValidIsoDate(form.exchangeDate)) {
      setError("Date must use YYYY-MM-DD");
      return;
    }

    const parsedMin = parseOptionalDecimal(form.budgetMin);
    const parsedMax = parseOptionalDecimal(form.budgetMax);
    if (Number.isNaN(parsedMin) || Number.isNaN(parsedMax) || (parsedMin ?? 0) < 0 || (parsedMax ?? 0) < 0) {
      setError("Budgets must be zero or a positive number");
      return;
    }

    if (
      parsedMin !== undefined &&
      parsedMax !== undefined &&
      parsedMin > parsedMax
    ) {
      setError("Minimum budget cannot be greater than maximum budget");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const exchange = await giftExchanges.create(buildCreateExchangePayload(form));
      track("mobile_exchange_created", {
        exchange_id: exchange.id,
        has_budget: Boolean(form.budgetMin.trim() || form.budgetMax.trim()),
        has_date: Boolean(form.exchangeDate.trim()),
        include_creator: form.includeCreator,
      });
      if (isCurrentScreen()) router.replace(`/(tabs)/exchanges/${exchange.id}`);
    } catch (submitError) {
      console.error("Failed to create exchange", submitError);
      setError(humanizeError(submitError, "Failed to create exchange"));
    } finally {
      setSaving(false);
    }
  }, [captureScreen, form, giftExchanges, router, track]);

  return {
    error,
    applyFamilyDefaults: () => setForm(buildFamilyExchangeFormValues()),
    form,
    handleCancel: () => router.back(),
    handleSubmit,
    saving,
    startBlank: () => setForm(EMPTY_EXCHANGE_FORM_VALUES),
    updateField,
    updateIncludeCreator,
  };
}

export function useExchangeDetailController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { giftExchanges, exchangeExclusions, exchangeParticipants } = useServices();
  const track = useAnalytics();
  const exchangeId = Number.parseInt(id ?? "", 10);
  const isValidExchangeId = Number.isFinite(exchangeId);
  const [starting, setStarting] = useState(false);
  const [schedulingReminder, setSchedulingReminder] = useState(false);
  const [resendingParticipantId, setResendingParticipantId] = useState<number | null>(null);
  const [exclusionModalVisible, setExclusionModalVisible] = useState(false);
  const [exclusionForm, setExclusionForm] = useState<ExchangeExclusionFormValues>(
    EMPTY_EXCHANGE_EXCLUSION_FORM_VALUES
  );
  const [savingExclusion, setSavingExclusion] = useState(false);
  const [exclusionFormError, setExclusionFormError] = useState<string | null>(null);

  const resource = useFocusResource<GiftExchangeWithParticipants | null>({
    enabled: isValidExchangeId,
    errorMessage: "Failed to load exchange",
    initialValue: null as GiftExchangeWithParticipants | null,
    key: exchangeId,
    load: () => giftExchanges.getById(exchangeId),
  });

  const exclusionsResource = useFocusResource<ExchangeExclusion[]>({
    enabled: isValidExchangeId && resource.data?.is_owner === true,
    errorMessage: "Failed to load exclusion rules",
    initialValue: [] as ExchangeExclusion[],
    key: resource.data?.updated_at ?? exchangeId,
    load: () => exchangeExclusions.getAll(exchangeId),
  });

  const startExchange = useCallback(() => {
    if (!resource.data || !canStartExchange(resource.data)) {
      return;
    }

    Alert.alert(
      "Draw Matches",
      getExchangeDrawConfirmation(resource.data),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Draw Matches",
          onPress: async () => {
            setStarting(true);

            try {
              const exchange = await giftExchanges.start(exchangeId);
              resource.setData(exchange);
              track("mobile_exchange_draw_completed", {
                accepted_count: exchange.accepted_count,
                exchange_id: exchange.id,
                exclusion_count: exclusionsResource.data.length,
                participant_count: exchange.participant_count,
              });
              await haptics.success();
            } catch (startError) {
              console.error("Failed to start exchange", startError);
              await haptics.error();
              Alert.alert("Could Not Draw Matches", humanizeError(startError, "Check participants and try again."));
            } finally {
              setStarting(false);
            }
          },
        },
      ]
    );
  }, [exchangeId, exclusionsResource.data.length, giftExchanges, resource, track]);

  const shareParticipantInvite = useCallback(
    async (participant: ExchangeParticipant) => {
      if (!participant.invite_token) {
        return;
      }

      const inviteUrl = buildExchangeInviteUrl(participant.invite_token);
      const exchangeName = resource.data?.name || "my gift exchange";

      try {
        await Share.share({
          message: `Join "${exchangeName}" on Listy Gifty: ${inviteUrl}`,
          url: inviteUrl,
        });
        track("mobile_exchange_invite_shared", {
          exchange_id: resource.data?.id,
          participant_id: participant.id,
          participant_status: participant.status,
          source: "exchange_detail",
        });
        await haptics.selection();
      } catch (shareError) {
        console.error("Failed to share exchange invite", shareError);
      }
    },
    [resource.data?.id, resource.data?.name, track]
  );

  const scheduleReminder = useCallback(async () => {
    if (!resource.data) {
      return;
    }

    setSchedulingReminder(true);

    try {
      const notificationId = await scheduleExchangeReminder(resource.data);
      if (!notificationId) {
        Alert.alert("Reminder Not Set", "Add a future exchange date and allow notifications.");
        return;
      }

      track("mobile_exchange_reminder_scheduled", {
        exchange_id: resource.data.id,
        notification_id: notificationId,
      });
      await haptics.success();
      Alert.alert("Reminder Set", "A private reminder is scheduled before the exchange date.");
    } catch (scheduleError) {
      console.error("Failed to schedule exchange reminder", scheduleError);
      await haptics.error();
      Alert.alert("Reminder Failed", "Could not schedule this reminder.");
    } finally {
      setSchedulingReminder(false);
    }
  }, [resource.data, track]);

  const shareExchangeJoinLink = useCallback(async () => {
    const exchange = resource.data;
    if (!exchange?.share_url) {
      Alert.alert("Link Unavailable", "Refresh the exchange and try again.");
      return;
    }

    try {
      await Share.share({
        message: `Join "${exchange.name}" on Listy Gifty: ${exchange.share_url}`,
        url: exchange.share_url,
      });
      track("mobile_exchange_join_link_shared", {
        exchange_id: exchange.id,
        source: "exchange_detail",
      });
      await haptics.selection();
    } catch (shareError) {
      console.error("Failed to share exchange join link", shareError);
      await haptics.error();
      Alert.alert("Share Failed", "Could not share this exchange link.");
    }
  }, [resource.data, track]);

  const copyExchangeJoinLink = useCallback(async () => {
    const exchange = resource.data;
    if (!exchange?.share_url) {
      Alert.alert("Link Unavailable", "Refresh the exchange and try again.");
      return;
    }

    try {
      await Clipboard.setStringAsync(exchange.share_url);
      track("mobile_exchange_join_link_copied", {
        exchange_id: exchange.id,
        source: "exchange_detail",
      });
      await haptics.selection();
      Alert.alert("Join Link Copied", "Anyone with this link can preview and join the exchange.");
    } catch (copyError) {
      console.error("Failed to copy exchange join link", copyError);
      await haptics.error();
      Alert.alert("Copy Failed", "Could not copy this exchange link.");
    }
  }, [resource.data, track]);

  const copyParticipantInvite = useCallback(
    async (participant: ExchangeParticipant) => {
      if (!participant.invite_token) {
        return;
      }

      const inviteUrl = buildExchangeInviteUrl(participant.invite_token);

      try {
        await Clipboard.setStringAsync(inviteUrl);
        track("mobile_exchange_invite_copied", {
          exchange_id: resource.data?.id,
          participant_id: participant.id,
          participant_status: participant.status,
          source: "exchange_detail",
        });
        await haptics.selection();
        Alert.alert("Invite Copied", "The participant invite link is ready to paste.");
      } catch (copyError) {
        console.error("Failed to copy exchange invite", copyError);
        await haptics.error();
        Alert.alert("Copy Failed", "Could not copy this invite link.");
      }
    },
    [resource.data?.id, track]
  );

  const canManageExclusions = Boolean(
    resource.data?.is_owner &&
      resource.data.status !== "active" &&
      resource.data.status !== "completed" &&
      resource.data.exchange_participants.length >= 2
  );

  const canSaveExclusion =
    canManageExclusions &&
    Boolean(exclusionForm.participantAId) &&
    Boolean(exclusionForm.participantBId) &&
    exclusionForm.participantAId !== exclusionForm.participantBId &&
    !hasExchangeExclusionBetween(
      exclusionsResource.data,
      exclusionForm.participantAId,
      exclusionForm.participantBId
    );

  const openExclusionModal = useCallback(() => {
    setExclusionForm(EMPTY_EXCHANGE_EXCLUSION_FORM_VALUES);
    setExclusionFormError(null);
    setExclusionModalVisible(true);
  }, []);

  const closeExclusionModal = useCallback(() => {
    setExclusionModalVisible(false);
    setExclusionFormError(null);
  }, []);

  const updateExclusionParticipant = useCallback(
    (field: keyof ExchangeExclusionFormValues, participantId: number) => {
      setExclusionForm((current) => {
        if (field === "participantAId" && current.participantBId === participantId) {
          return { participantAId: participantId, participantBId: null };
        }

        if (field === "participantBId" && current.participantAId === participantId) {
          return { participantAId: null, participantBId: participantId };
        }

        return { ...current, [field]: participantId };
      });
      setExclusionFormError(null);
    },
    []
  );

  const createExclusion = useCallback(async () => {
    if (!canManageExclusions) {
      setExclusionFormError("Add at least two participants before creating an exclusion.");
      return;
    }

    if (!exclusionForm.participantAId || !exclusionForm.participantBId) {
      setExclusionFormError("Choose two participants.");
      return;
    }

    if (exclusionForm.participantAId === exclusionForm.participantBId) {
      setExclusionFormError("Choose two different participants.");
      return;
    }

    if (
      hasExchangeExclusionBetween(
        exclusionsResource.data,
        exclusionForm.participantAId,
        exclusionForm.participantBId
      )
    ) {
      setExclusionFormError("That exclusion already exists.");
      return;
    }

    setSavingExclusion(true);
    setExclusionFormError(null);

    try {
      const exclusion = await exchangeExclusions.create(
        exchangeId,
        buildCreateExchangeExclusionPayload(exclusionForm)
      );
      exclusionsResource.setData((current) => [...current, exclusion]);
      track("mobile_exchange_exclusion_added", {
        exchange_id: exchangeId,
        exclusion_id: exclusion.id,
      });
      setExclusionForm(EMPTY_EXCHANGE_EXCLUSION_FORM_VALUES);
      setExclusionModalVisible(false);
      await haptics.success();
    } catch (createError) {
      console.error("Failed to add exclusion rule", createError);
      await haptics.error();
      setExclusionFormError("Failed to add exclusion rule.");
    } finally {
      setSavingExclusion(false);
    }
  }, [
    canManageExclusions,
    exchangeExclusions,
    exchangeId,
    exclusionForm,
    exclusionsResource,
    track,
  ]);

  const removeExclusion = useCallback(
    (exclusion: ExchangeExclusion) => {
      Alert.alert(
        "Remove Exclusion",
        `Allow ${exclusion.participant_a.name} and ${exclusion.participant_b.name} to match?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await exchangeExclusions.delete(exchangeId, exclusion.id);
                exclusionsResource.setData((current) =>
                  current.filter((item) => item.id !== exclusion.id)
                );
                track("mobile_exchange_exclusion_removed", {
                  exchange_id: exchangeId,
                  exclusion_id: exclusion.id,
                });
                await haptics.selection();
              } catch (removeError) {
                console.error("Failed to remove exclusion rule", removeError);
                await haptics.error();
                Alert.alert("Could Not Remove Rule", "Check the exchange and try again.");
              }
            },
          },
        ]
      );
    },
    [exchangeExclusions, exchangeId, exclusionsResource, track]
  );

  const reinviteParticipant = useCallback((participant: ExchangeParticipant) => {
    if (resendingParticipantId !== null || participant.status !== "declined") return;
    Alert.alert("Invite again?", `Email a new invitation to ${participant.email}? They can choose whether to join.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send invitation",
        onPress: async () => {
          setResendingParticipantId(participant.id);
          try {
            await exchangeParticipants.resendInvite(exchangeId, participant.id);
            await resource.reload();
            await haptics.success();
          } catch (error) {
            Alert.alert("Invitation Not Sent", humanizeError(error, "Could not send the invitation. Try again."));
          } finally {
            setResendingParticipantId(null);
          }
        },
      },
    ]);
  }, [exchangeId, exchangeParticipants, resendingParticipantId, resource]);

  const triggerRefresh = useCallback(() => {
    resource.refresh();
    if (resource.data?.is_owner) {
      exclusionsResource.refresh();
    }
  }, [exclusionsResource, resource]);

  return {
    canShareJoinLink: Boolean(
      resource.data?.is_owner &&
        resource.data.share_url &&
        (resource.data.status === "draft" || resource.data.status === "inviting")
    ),
    canStartExchange: resource.data ? canStartExchange(resource.data) : false,
    canScheduleReminder: resource.data ? canScheduleExchangeReminder(resource.data) : false,
    canManageExclusions,
    canSaveExclusion,
    closeExclusionModal,
    copyExchangeJoinLink,
    copyParticipantInvite,
    createExclusion,
    error: !isValidExchangeId ? "Invalid exchange ID" : resource.error,
    exclusionForm,
    exclusionFormError,
    exclusionModalVisible,
    exclusions: exclusionsResource.data,
    exclusionsError: exclusionsResource.error,
    exclusionsLoading: exclusionsResource.loading,
    exchange: resource.data,
    goToMatch: () => router.push(`/(tabs)/exchanges/${exchangeId}/my-match`),
    goToNewParticipant: () =>
      router.push(`/(tabs)/exchanges/${exchangeId}/participants/new`),
    goToWishlist: () => router.push(`/(tabs)/exchanges/${exchangeId}/my-wishlist`),
    handleStartExchange: startExchange,
    handleScheduleReminder: scheduleReminder,
    loading: isValidExchangeId && resource.loading,
    openExclusionModal,
    refreshing: resource.refreshing,
    readinessItems: resource.data
      ? getExchangeReadinessItems(resource.data, exclusionsResource.data.length)
      : [],
    removeExclusion,
    reinviteParticipant,
    resendingParticipantId,
    retryLoad: resource.reload,
    shareExchangeJoinLink,
    shareParticipantInvite,
    savingExclusion,
    schedulingReminder,
    starting,
    startBlocker: resource.data ? getExchangeStartBlocker(resource.data) : null,
    triggerRefresh,
    updateExclusionParticipant,
  };
}

export function useNewExchangeParticipantController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const captureScreen = useScreenActivity();
  const { exchangeParticipants } = useServices();
  const track = useAnalytics();
  const exchangeId = Number.parseInt(id ?? "", 10);
  const isValidExchangeId = Number.isFinite(exchangeId);

  const [form, setForm] = useState<ExchangeParticipantFormValues>(
    EMPTY_EXCHANGE_PARTICIPANT_FORM_VALUES
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback((field: keyof ExchangeParticipantFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const isCurrentScreen = captureScreen();
    if (!isValidExchangeId) {
      setError("Invalid exchange ID");
      return;
    }

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Valid email is required");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const participant = await exchangeParticipants.create(
        exchangeId,
        buildCreateExchangeParticipantPayload(form)
      );
      track("mobile_exchange_participant_invited", {
        exchange_id: exchangeId,
        participant_id: participant.id,
      });
      if (isCurrentScreen()) router.back();
    } catch (submitError) {
      console.error("Failed to add participant", submitError);
      setError(humanizeError(submitError, "Failed to add participant"));
    } finally {
      setSaving(false);
    }
  }, [captureScreen, exchangeId, exchangeParticipants, form, isValidExchangeId, router, track]);

  return {
    error,
    form,
    handleCancel: () => router.back(),
    handleSubmit,
    saving,
    updateField,
  };
}

export function useExchangeMatchController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { giftExchanges, wishlistItems } = useServices();
  const exchangeId = Number.parseInt(id ?? "", 10);
  const isValidExchangeId = Number.isFinite(exchangeId);

  const [nudging, setNudging] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  useEffect(() => { setNudgeSent(false); setNudgeError(null); }, [exchangeId]);

  const resource = useFocusResource<ExchangeMatchState>({
    enabled: isValidExchangeId,
    errorMessage: "Failed to load match details",
    initialValue: {
      exchange: null,
      matchWishlist: [],
    } satisfies ExchangeMatchState,
    key: exchangeId,
    load: async () => {
      const exchange = await giftExchanges.getById(exchangeId);
      const matchId = exchange.my_participant?.matched_participant_id;
      const matchWishlist = matchId ? await wishlistItems.getAll(exchangeId, matchId) : [];
      return { exchange, matchWishlist };
    },
  });

  const nudgeMatch = useCallback(async () => {
    if (nudging || nudgeSent || !resource.data.exchange?.capabilities.nudge_match) return;
    setNudging(true);
    setNudgeError(null);
    try {
      await giftExchanges.nudgeMatch(exchangeId);
      setNudgeSent(true);
      await haptics.success();
    } catch (error) {
      setNudgeError(humanizeError(error, "Could not send the request. Try again."));
    } finally {
      setNudging(false);
    }
  }, [exchangeId, giftExchanges, nudgeSent, nudging, resource.data.exchange]);

  return {
    nudgeMatch, nudging, nudgeSent, nudgeError,
    error: !isValidExchangeId ? "Invalid exchange ID" : resource.error,
    exchange: resource.data.exchange,
    loading: isValidExchangeId && resource.loading,
    matchWishlist: resource.data.matchWishlist,
    refreshing: resource.refreshing,
    retryLoad: resource.reload,
    triggerRefresh: resource.refresh,
  };
}

export function useExchangeWishlistController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { giftExchanges, wishlistItems } = useServices();
  const exchangeId = Number.parseInt(id ?? "", 10);
  const isValidExchangeId = Number.isFinite(exchangeId);

  const resource = useFocusResource<ExchangeWishlistState>({
    enabled: isValidExchangeId,
    errorMessage: "Failed to load wishlist",
    initialValue: {
      exchange: null,
      items: [],
    } satisfies ExchangeWishlistState,
    key: exchangeId,
    load: async () => {
      const exchange = await giftExchanges.getById(exchangeId);
      const participantId = exchange.my_participant?.id;
      const items = participantId ? await wishlistItems.getAll(exchangeId, participantId) : [];
      return { exchange, items };
    },
  });

  const addItem = useCallback(() => {
    const participantId = resource.data.exchange?.my_participant?.id;
    if (!participantId) {
      return;
    }

    router.push({
      pathname: "/(tabs)/exchanges/wishlist/new",
      params: { exchange_id: exchangeId.toString(), participant_id: participantId.toString() },
    });
  }, [exchangeId, resource.data.exchange?.my_participant?.id, router]);

  const deleteItem = useCallback(
    (itemId: number) => {
      const participantId = resource.data.exchange?.my_participant?.id;
      if (!participantId) {
        return;
      }

      Alert.alert(
        "Delete Item",
        "Are you sure you want to remove this item from your wishlist?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await wishlistItems.delete(exchangeId, participantId, itemId);
                resource.setData((current) => ({
                  ...current,
                  items: current.items.filter((item) => item.id !== itemId),
                }));
              } catch (deleteError) {
                console.error("Failed to delete wishlist item", deleteError);
                Alert.alert("Error", "Failed to delete item");
              }
            },
          },
        ]
      );
    },
    [exchangeId, resource, resource.data.exchange?.my_participant?.id, wishlistItems]
  );

  return {
    error: !isValidExchangeId ? "Invalid exchange ID" : resource.error,
    exchange: resource.data.exchange,
    handleAddItem: addItem,
    handleDeleteItem: deleteItem,
    items: resource.data.items,
    loading: isValidExchangeId && resource.loading,
    refreshing: resource.refreshing,
    retryLoad: resource.reload,
    triggerRefresh: resource.refresh,
  };
}

export function useNewWishlistItemController() {
  const router = useRouter();
  const captureScreen = useScreenActivity();
  const { exchange_id, participant_id } = useLocalSearchParams<{
    exchange_id: string;
    participant_id: string;
  }>();
  const { wishlistItems } = useServices();
  const track = useAnalytics();
  const exchangeId = exchange_id ? Number.parseInt(exchange_id, 10) : Number.NaN;
  const participantId = participant_id ? Number.parseInt(participant_id, 10) : Number.NaN;

  const [form, setForm] = useState<WishlistItemFormValues>(EMPTY_WISHLIST_ITEM_FORM_VALUES);
  const [savedItemName, setSavedItemName] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState<WishlistItemSaveMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = savingMode !== null;

  const updateField = useCallback((field: keyof WishlistItemFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const submitItem = useCallback(async (mode: WishlistItemSaveMode) => {
    const isCurrentScreen = captureScreen();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!Number.isFinite(exchangeId) || !Number.isFinite(participantId)) {
      setError("Missing exchange or participant information");
      return;
    }

    const parsedPrice = parseOptionalDecimal(form.price);
    if (Number.isNaN(parsedPrice)) {
      setError("Approximate price must be a valid number");
      return;
    }

    setError(null);
    setSavingMode(mode);

    try {
      const item = await wishlistItems.create(
        exchangeId,
        participantId,
        buildCreateWishlistItemPayload(form)
      );
      track("mobile_exchange_wishlist_item_added", {
        exchange_id: exchangeId,
        item_id: item.id,
        participant_id: participantId,
        save_mode: mode,
      });
      if (!isCurrentScreen()) return;
      if (mode === "another") {
        setSavedItemName(item.name);
        setForm(buildRepeatWishlistItemFormValues());
        await haptics.success();
      } else {
        if (isCurrentScreen()) router.back();
      }
    } catch (submitError) {
      console.error("Failed to add wishlist item", submitError);
      setError(humanizeError(submitError, "Failed to add item"));
    } finally {
      setSavingMode(null);
    }
  }, [captureScreen, exchangeId, form, participantId, router, track, wishlistItems]);

  return {
    error,
    form,
    handleCancel: () => router.back(),
    handleSubmit: () => submitItem("done"),
    handleSubmitAndAddAnother: () => submitItem("another"),
    loading,
    savedItemName,
    savingMode,
    updateField,
  };
}

export function useExchangeShareJoinController() {
  const { slug, shareToken } = useLocalSearchParams<{
    slug?: string;
    shareToken?: string;
  }>();
  const router = useRouter();
  const captureScreen = useScreenActivity();
  const clerkAuth = useAuth();
  const isSignedIn = runtimeConfig.screenshotMode ? false : clerkAuth.isSignedIn;
  const isLoaded = runtimeConfig.screenshotMode ? true : clerkAuth.isLoaded;
  const { exchangeJoins } = useServices();
  const track = useAnalytics();
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasRouteParams = Boolean(slug && shareToken);

  const resource = useFocusResource({
    enabled: hasRouteParams,
    errorMessage: "This join link is invalid or has expired",
    initialValue: null as ExchangeJoinDetails | null,
    key: hasRouteParams ? `${slug}:${shareToken}` : null,
    load: () => exchangeJoins.getDetails(shareToken as string),
  });

  const canonicalPath = resource.data && shareToken
    ? (`/e/${resource.data.exchange.slug}/${shareToken}` as const)
    : null;

  useEffect(() => {
    if (canonicalPath && slug !== resource.data?.exchange.slug) {
      router.replace(canonicalPath);
    }
  }, [canonicalPath, resource.data?.exchange.slug, router, slug]);

  const routeToAuth = useCallback(
    (pathname: "/auth/login" | "/auth/signup") => {
      const returnTo = normalizeAuthReturnPath(canonicalPath || undefined);
      router.push({
        pathname,
        params: returnTo ? { returnTo } : {},
      });
    },
    [canonicalPath, router]
  );

  const handleJoin = useCallback(async () => {
    const isCurrentScreen = captureScreen();
    if (!shareToken || !isSignedIn || !resource.data?.join_open || joining) {
      return;
    }

    setJoining(true);
    setActionError(null);

    try {
      const result = await exchangeJoins.join(shareToken, name.trim() || undefined);
      track("mobile_exchange_share_link_joined", {
        exchange_id: result.exchange.id,
        source: "shared_exchange_link",
      });
      await haptics.success();
      if (isCurrentScreen()) router.replace(`/(tabs)/exchanges/${result.exchange.id}`);
    } catch (joinError) {
      console.error("Failed to join shared exchange", joinError);
      await haptics.error();
      setActionError(humanizeError(joinError, "Could not join this exchange. Check the link and try again."));
    } finally {
      setJoining(false);
    }
  }, [captureScreen, exchangeJoins, isSignedIn, joining, name, resource.data?.join_open, router, shareToken, track]);

  return {
    actionError,
    details: resource.data,
    error: !hasRouteParams ? "This join link is invalid" : resource.error,
    handleJoin,
    isLoaded,
    isSignedIn,
    joining,
    loading: !isLoaded || (hasRouteParams && resource.loading),
    name,
    retryLoad: resource.reload,
    routeToExchanges: () => router.replace("/(tabs)/exchanges"),
    routeToLogin: () => routeToAuth("/auth/login"),
    routeToSignup: () => routeToAuth("/auth/signup"),
    setName: (value: string) => {
      setActionError(null);
      setName(value);
    },
  };
}

export function useExchangeInviteController() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const captureScreen = useScreenActivity();
  const clerkAuth = useAuth();
  const isSignedIn = runtimeConfig.screenshotMode ? false : clerkAuth.isSignedIn;
  const isLoaded = runtimeConfig.screenshotMode ? true : clerkAuth.isLoaded;
  const { exchangeInvites } = useServices();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const hasToken = Boolean(token);
  const authReturnPath = normalizeAuthReturnPath(
    token ? `/join/exchange/${token}` : undefined
  );

  const resource = useFocusResource({
    enabled: hasToken,
    errorMessage: "This invite link is invalid or has expired",
    initialValue: null as ExchangeInviteDetails | null,
    key: token,
    load: () => exchangeInvites.getByToken(token as string),
  });

  const handleAccept = useCallback(async () => {
    const isCurrentScreen = captureScreen();
    if (!token || !isSignedIn || actionLoading) {
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      const result = await exchangeInvites.accept(token);
      if (isCurrentScreen()) router.replace(`/(tabs)/exchanges/${result.exchange.id}`);
    } catch (acceptError) {
      console.error("Failed to accept invitation", acceptError);
      setActionError(humanizeError(acceptError, "Could not join. Please try again."));
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, captureScreen, exchangeInvites, isSignedIn, router, token]);

  const handleDecline = useCallback(async () => {
    const isCurrentScreen = captureScreen();
    if (!token || !isSignedIn || actionLoading) {
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await exchangeInvites.decline(token);
      if (isCurrentScreen()) router.replace("/(tabs)/exchanges");
    } catch (declineError) {
      console.error("Failed to decline invitation", declineError);
      setActionError(humanizeError(declineError, "Could not decline. Please try again."));
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, captureScreen, exchangeInvites, isSignedIn, router, token]);

  return {
    actionError,
    actionLoading,
    authReturnPath,
    error: !hasToken ? "Invalid invite link" : resource.error,
    handleAccept,
    handleDecline: () => Alert.alert("Decline invitation?", "You won't take part in this exchange. Ask the organizer for a new invite if you change your mind.", [
      { text: "Keep invitation", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: handleDecline },
    ]),
    invite: resource.data,
    isLoaded,
    isSignedIn,
    loading: !isLoaded || (hasToken && resource.loading),
    retryLoad: resource.reload,
    routeToExchange: (exchangeId: number) => router.replace(`/(tabs)/exchanges/${exchangeId}`),
    switchAccount: async () => {
      await clerkAuth.signOut();
      router.replace({ pathname: "/auth/login", params: authReturnPath ? { returnTo: authReturnPath } : {} });
    },
    routeToExchanges: () => router.replace("/(tabs)/exchanges"),
  };
}

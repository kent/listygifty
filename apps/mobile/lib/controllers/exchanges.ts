import { useCallback, useMemo, useState } from "react";
import { Alert, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { haptics } from "@/lib/haptics";
import { useServices } from "@/lib/use-api";
import { useFocusResource } from "@/lib/controllers/use-focus-resource";
import {
  buildCreateExchangePayload,
  buildCreateExchangeParticipantPayload,
  buildExchangeInviteUrl,
  buildCreateWishlistItemPayload,
  canStartExchange,
  EMPTY_EXCHANGE_PARTICIPANT_FORM_VALUES,
  buildExchangeSections,
  EMPTY_EXCHANGE_FORM_VALUES,
  EMPTY_WISHLIST_ITEM_FORM_VALUES,
  getExchangeStartBlocker,
  isValidIsoDate,
  parseOptionalDecimal,
  type ExchangeParticipantFormValues,
  type ExchangeFormValues,
  type ExchangeInviteDetails,
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
  const { giftExchanges } = useServices();
  const [form, setForm] = useState<ExchangeFormValues>(EMPTY_EXCHANGE_FORM_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback((field: keyof ExchangeFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
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
    if (Number.isNaN(parsedMin) || Number.isNaN(parsedMax)) {
      setError("Budgets must be valid numbers");
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
      router.replace(`/(tabs)/exchanges/${exchange.id}`);
    } catch (submitError) {
      console.error("Failed to create exchange", submitError);
      setError("Failed to create exchange");
    } finally {
      setSaving(false);
    }
  }, [form, giftExchanges, router]);

  return {
    error,
    form,
    handleCancel: () => router.back(),
    handleSubmit,
    saving,
    updateField,
  };
}

export function useExchangeDetailController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { giftExchanges } = useServices();
  const exchangeId = Number.parseInt(id ?? "", 10);
  const isValidExchangeId = Number.isFinite(exchangeId);
  const [starting, setStarting] = useState(false);

  const resource = useFocusResource<GiftExchangeWithParticipants | null>({
    enabled: isValidExchangeId,
    errorMessage: "Failed to load exchange",
    initialValue: null as GiftExchangeWithParticipants | null,
    key: exchangeId,
    load: () => giftExchanges.getById(exchangeId),
  });

  const startExchange = useCallback(() => {
    if (!resource.data || !canStartExchange(resource.data)) {
      return;
    }

    Alert.alert(
      "Draw Matches",
      "This will assign each participant a match and send match emails.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Draw Matches",
          onPress: async () => {
            setStarting(true);

            try {
              const exchange = await giftExchanges.start(exchangeId);
              resource.setData(exchange);
              await haptics.success();
            } catch (startError) {
              console.error("Failed to start exchange", startError);
              await haptics.error();
              Alert.alert("Could Not Draw Matches", "Check participants and try again.");
            } finally {
              setStarting(false);
            }
          },
        },
      ]
    );
  }, [exchangeId, giftExchanges, resource]);

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
        await haptics.selection();
      } catch (shareError) {
        console.error("Failed to share exchange invite", shareError);
      }
    },
    [resource.data?.name]
  );

  return {
    canStartExchange: resource.data ? canStartExchange(resource.data) : false,
    error: !isValidExchangeId ? "Invalid exchange ID" : resource.error,
    exchange: resource.data,
    goToMatch: () => router.push(`/(tabs)/exchanges/${exchangeId}/my-match`),
    goToNewParticipant: () =>
      router.push(`/(tabs)/exchanges/${exchangeId}/participants/new`),
    goToWishlist: () => router.push(`/(tabs)/exchanges/${exchangeId}/my-wishlist`),
    handleStartExchange: startExchange,
    loading: isValidExchangeId && resource.loading,
    refreshing: resource.refreshing,
    retryLoad: resource.reload,
    shareParticipantInvite,
    starting,
    startBlocker: resource.data ? getExchangeStartBlocker(resource.data) : null,
    triggerRefresh: resource.refresh,
  };
}

export function useNewExchangeParticipantController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { exchangeParticipants } = useServices();
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
    if (!isValidExchangeId) {
      setError("Invalid exchange ID");
      return;
    }

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!form.email.trim() || !form.email.includes("@")) {
      setError("Valid email is required");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await exchangeParticipants.create(
        exchangeId,
        buildCreateExchangeParticipantPayload(form)
      );
      router.back();
    } catch (submitError) {
      console.error("Failed to add participant", submitError);
      setError("Failed to add participant");
    } finally {
      setSaving(false);
    }
  }, [exchangeId, exchangeParticipants, form, isValidExchangeId, router]);

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

  return {
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
  const { exchange_id, participant_id } = useLocalSearchParams<{
    exchange_id: string;
    participant_id: string;
  }>();
  const { wishlistItems } = useServices();
  const exchangeId = exchange_id ? Number.parseInt(exchange_id, 10) : Number.NaN;
  const participantId = participant_id ? Number.parseInt(participant_id, 10) : Number.NaN;

  const [form, setForm] = useState<WishlistItemFormValues>(EMPTY_WISHLIST_ITEM_FORM_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback((field: keyof WishlistItemFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
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
    setLoading(true);

    try {
      await wishlistItems.create(
        exchangeId,
        participantId,
        buildCreateWishlistItemPayload(form)
      );
      router.back();
    } catch (submitError) {
      console.error("Failed to add wishlist item", submitError);
      setError("Failed to add item");
    } finally {
      setLoading(false);
    }
  }, [exchangeId, form, participantId, router, wishlistItems]);

  return {
    error,
    form,
    handleCancel: () => router.back(),
    handleSubmit,
    loading,
    updateField,
  };
}

export function useExchangeInviteController() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { exchangeInvites } = useServices();
  const [actionLoading, setActionLoading] = useState(false);
  const hasToken = Boolean(token);

  const resource = useFocusResource({
    enabled: hasToken,
    errorMessage: "This invite link is invalid or has expired",
    initialValue: null as ExchangeInviteDetails | null,
    key: token,
    load: () => exchangeInvites.getByToken(token as string),
  });

  const handleAccept = useCallback(async () => {
    if (!token) {
      return;
    }

    setActionLoading(true);
    resource.setError(null);

    try {
      const result = await exchangeInvites.accept(token);
      router.replace(`/(tabs)/exchanges/${result.exchange.id}`);
    } catch (acceptError) {
      console.error("Failed to accept invitation", acceptError);
      resource.setError("Failed to accept invitation");
    } finally {
      setActionLoading(false);
    }
  }, [exchangeInvites, resource, router, token]);

  const handleDecline = useCallback(async () => {
    if (!token) {
      return;
    }

    setActionLoading(true);
    resource.setError(null);

    try {
      await exchangeInvites.decline(token);
      router.replace("/(tabs)/exchanges");
    } catch (declineError) {
      console.error("Failed to decline invitation", declineError);
      resource.setError("Failed to decline invitation");
    } finally {
      setActionLoading(false);
    }
  }, [exchangeInvites, resource, router, token]);

  return {
    actionLoading,
    error: !hasToken ? "Invalid invite link" : resource.error,
    handleAccept,
    handleDecline,
    invite: resource.data,
    isLoaded,
    isSignedIn,
    loading: !isLoaded || (hasToken && resource.loading),
    retryLoad: resource.reload,
    routeToExchange: (exchangeId: number) => router.replace(`/(tabs)/exchanges/${exchangeId}`),
    routeToExchanges: () => router.replace("/(tabs)/exchanges"),
  };
}

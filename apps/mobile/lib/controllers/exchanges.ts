import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useServices } from "@/lib/use-api";
import { useFocusResource } from "@/lib/controllers/use-focus-resource";
import {
  buildCreateWishlistItemPayload,
  buildExchangeSections,
  EMPTY_WISHLIST_ITEM_FORM_VALUES,
  parseOptionalDecimal,
  type ExchangeInviteDetails,
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
    refreshing: resource.refreshing,
    retryLoad: resource.reload,
    sections,
    triggerRefresh: resource.refresh,
  };
}

export function useExchangeDetailController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { giftExchanges } = useServices();
  const exchangeId = Number.parseInt(id ?? "", 10);
  const isValidExchangeId = Number.isFinite(exchangeId);

  const resource = useFocusResource<GiftExchangeWithParticipants | null>({
    enabled: isValidExchangeId,
    errorMessage: "Failed to load exchange",
    initialValue: null as GiftExchangeWithParticipants | null,
    key: exchangeId,
    load: () => giftExchanges.getById(exchangeId),
  });

  return {
    error: !isValidExchangeId ? "Invalid exchange ID" : resource.error,
    exchange: resource.data,
    goToMatch: () => router.push(`/(tabs)/exchanges/${exchangeId}/my-match`),
    goToWishlist: () => router.push(`/(tabs)/exchanges/${exchangeId}/my-wishlist`),
    loading: isValidExchangeId && resource.loading,
    refreshing: resource.refreshing,
    retryLoad: resource.reload,
    triggerRefresh: resource.refresh,
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

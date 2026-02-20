import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useServices } from "@/lib/use-api";
import { useTheme } from "@/lib/theme";
import type { GiftExchangeWithParticipants, WishlistItem } from "@niftygifty/types";
import { MatchRevealCard } from "@/components/MatchRevealCard";
import { WishlistItemCard } from "@/components/WishlistItemCard";
import { ScreenLoader } from "@/components/ScreenLoader";

export default function MyMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { giftExchanges, wishlistItems } = useServices();
  const { colors } = useTheme();

  const [exchange, setExchange] = useState<GiftExchangeWithParticipants | null>(null);
  const [matchWishlist, setMatchWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exchangeId = parseInt(id, 10);
  const myParticipant = exchange?.my_participant;
  const matchedParticipant = myParticipant?.matched_participant;

  const fetchData = useCallback(async () => {
    if (isNaN(exchangeId)) {
      setError("Invalid exchange ID");
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Get exchange to find our participant and match
      const exchangeData = await giftExchanges.getById(exchangeId);
      setExchange(exchangeData);

      // Fetch match's wishlist if we have a matched participant ID
      const matchId = exchangeData.my_participant?.matched_participant_id;
      if (matchId) {
        const wishlist = await wishlistItems.getAll(exchangeId, matchId);
        setMatchWishlist(wishlist);
      }
    } catch (err) {
      setError("Failed to load match details");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [exchangeId, giftExchanges, wishlistItems]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <ScreenLoader />;
  }

  if (!exchange || !matchedParticipant) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <Text style={{ color: colors.error, fontSize: 16, textAlign: "center" }}>
          {error || "Match not found. The exchange may not have started yet."}
        </Text>
      </View>
    );
  }

  const matchName = matchedParticipant.display_name || matchedParticipant.name;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Your Match" }} />

      <FlatList
        data={matchWishlist}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 24 }}>
            <MatchRevealCard
              matchName={matchName}
              exchangeDate={exchange.exchange_date}
              budgetMin={exchange.budget_min}
              budgetMax={exchange.budget_max}
            />

            {/* Wishlist header */}
            <View style={{ marginTop: 24, marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 4 }}>
                {matchName}'s Wishlist
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {matchWishlist.length} item{matchWishlist.length !== 1 ? "s" : ""} to choose from
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: 12 }}>
            <WishlistItemCard item={item} />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 32, backgroundColor: colors.card, borderRadius: 12 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📝</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center", paddingHorizontal: 24 }}>
              {matchName} hasn't added any items to their wishlist yet.
              Check back later for gift ideas!
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ marginTop: 24, alignItems: "center", paddingBottom: 32 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Remember: Keep your match a secret! 🤫
            </Text>
          </View>
        }
      />
    </View>
  );
}

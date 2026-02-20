import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useServices } from "@/lib/use-api";
import { useTheme } from "@/lib/theme";
import type { GiftExchangeWithParticipants } from "@niftygifty/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ParticipantListItem } from "@/components/ParticipantListItem";
import { ScreenLoader } from "@/components/ScreenLoader";
import { formatBudgetRange, formatLongDate } from "@/lib/formatters";

export default function ExchangeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { giftExchanges, exchangeInvites } = useServices();
  const { colors } = useTheme();

  const [exchange, setExchange] = useState<GiftExchangeWithParticipants | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exchangeId = parseInt(id, 10);

  const fetchExchange = useCallback(async () => {
    if (isNaN(exchangeId)) {
      setError("Invalid exchange ID");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await giftExchanges.getById(exchangeId);
      setExchange(data);
    } catch (err) {
      setError("Failed to load exchange");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [exchangeId, giftExchanges]);

  useEffect(() => {
    fetchExchange();
  }, [fetchExchange]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchExchange();
  }, [fetchExchange]);

  const formattedExchangeDate = formatLongDate(exchange?.exchange_date);
  const formattedBudgetRange = formatBudgetRange(exchange?.budget_min, exchange?.budget_max);

  // Find current user's participant record
  const myParticipant = exchange?.my_participant;
  const isActive = exchange?.status === "active";
  const hasMatch = myParticipant?.matched_participant_id != null;

  const handleGoToWishlist = () => {
    router.push(`/(tabs)/exchanges/${exchangeId}/my-wishlist`);
  };

  const handleGoToMatch = () => {
    router.push(`/(tabs)/exchanges/${exchangeId}/my-match`);
  };

  if (loading) {
    return <ScreenLoader />;
  }

  if (!exchange) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <Text style={{ color: colors.error, fontSize: 16, textAlign: "center" }}>
          {error || "Exchange not found"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: exchange.name }} />

      {/* Header Card */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700", flex: 1 }}>
            {exchange.name}
          </Text>
          {exchange.is_owner ? (
            <Ionicons name="ribbon" size={20} color={colors.warning} />
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <StatusBadge status={exchange.status as "draft" | "inviting" | "active" | "completed"} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="people-outline" size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {exchange.accepted_count}/{exchange.participant_count}
            </Text>
          </View>
        </View>

        {formattedExchangeDate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
              {formattedExchangeDate}
            </Text>
          </View>
        ) : null}

        {formattedBudgetRange ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="cash-outline" size={16} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 14 }}>
              Budget: {formattedBudgetRange}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action Buttons for Active Exchange */}
      {isActive && myParticipant ? (
        <View style={{ gap: 12, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={handleGoToWishlist}
            style={{
              backgroundColor: colors.primary,
              padding: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="list-outline" size={24} color={colors.textInverse} />
              <View>
                <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "600" }}>My Wishlist</Text>
                <Text style={{ color: colors.primaryLight, fontSize: 12 }}>
                  {myParticipant.wishlist_count} items
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
          </TouchableOpacity>

          {hasMatch ? (
            <TouchableOpacity
              onPress={handleGoToMatch}
              style={{
                backgroundColor: colors.successLight,
                padding: 16,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name="gift-outline" size={24} color={colors.success} />
                <View>
                  <Text style={{ color: colors.success, fontSize: 16, fontWeight: "600" }}>View My Match</Text>
                  <Text style={{ color: colors.successDark, fontSize: 12 }}>See who you're buying for</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.success} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Participants List */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
          Participants
        </Text>

        {exchange.exchange_participants.map((participant, index) => (
          <ParticipantListItem
            key={participant.id}
            participant={participant}
            showWishlistCount={isActive}
          />
        ))}
      </View>

      {/* Secret reminder for active exchanges */}
      {isActive ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Remember: Keep your match a secret! 🤫
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

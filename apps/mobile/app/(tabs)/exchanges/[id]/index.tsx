import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ParticipantListItem } from "@/components/ParticipantListItem";
import { ScreenLoader } from "@/components/ScreenLoader";
import { formatBudgetRange, formatLongDate } from "@/lib/formatters";
import { useTheme } from "@/lib/theme";
import { useExchangeDetailController } from "@/lib/controllers";

export default function ExchangeDetailScreen() {
  const { colors } = useTheme();
  const controller = useExchangeDetailController();
  const exchange = controller.exchange;

  if (controller.loading) {
    return <ScreenLoader />;
  }

  if (!exchange) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 32,
        }}
      >
        <Text style={{ color: colors.error, fontSize: 16, textAlign: "center" }}>
          {controller.error || "Exchange not found"}
        </Text>
      </View>
    );
  }

  const formattedExchangeDate = formatLongDate(exchange.exchange_date);
  const formattedBudgetRange = formatBudgetRange(exchange.budget_min, exchange.budget_max);
  const myParticipant = exchange.my_participant;
  const isActive = exchange.status === "active";
  const hasMatch = myParticipant?.matched_participant_id != null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={controller.refreshing}
          onRefresh={controller.triggerRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: exchange.name }} />

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
          {exchange.is_owner ? <Ionicons name="ribbon" size={20} color={colors.warning} /> : null}
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
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{formattedExchangeDate}</Text>
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

      {isActive && myParticipant ? (
        <View style={{ gap: 12, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={controller.goToWishlist}
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
                <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "600" }}>
                  My Wishlist
                </Text>
                <Text style={{ color: colors.primaryLight, fontSize: 12 }}>
                  {myParticipant.wishlist_count} items
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
          </TouchableOpacity>

          {hasMatch ? (
            <TouchableOpacity
              onPress={controller.goToMatch}
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
                  <Text style={{ color: colors.success, fontSize: 16, fontWeight: "600" }}>
                    View My Match
                  </Text>
                  <Text style={{ color: colors.successDark, fontSize: 12 }}>
                    See who you're buying for
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.success} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

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

        {exchange.exchange_participants.map((participant) => (
          <ParticipantListItem
            key={participant.id}
            participant={participant}
            showWishlistCount={isActive}
          />
        ))}
      </View>

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

import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { GiftExchange } from "@niftygifty/types";
import { StatusBadge } from "./StatusBadge";
import { HapticPressable } from "@/components/HapticPressable";
import { useTheme } from "@/lib/theme";
import { formatBudgetRange, formatShortDate } from "@/lib/formatters";

interface ExchangeCardProps {
  exchange: GiftExchange;
  onPress: () => void;
}

export function ExchangeCard({ exchange, onPress }: ExchangeCardProps) {
  const { colors } = useTheme();
  const formattedDate = formatShortDate(exchange.exchange_date);
  const budgetRange = formatBudgetRange(exchange.budget_min, exchange.budget_max);

  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open exchange ${exchange.name}`}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }} numberOfLines={1}>
              {exchange.name}
            </Text>
            {exchange.is_owner ? (
              <Ionicons name="ribbon" size={16} color={colors.warning} />
            ) : null}
          </View>

          {formattedDate ? (
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
              {formattedDate}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <StatusBadge status={exchange.status as "draft" | "inviting" | "active" | "completed"} />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="people-outline" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {exchange.accepted_count}/{exchange.participant_count} accepted
              </Text>
            </View>
          </View>

          {/* Budget info if available */}
          {budgetRange ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
              <Ionicons name="cash-outline" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {budgetRange}
              </Text>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </HapticPressable>
  );
}

import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { GiftListSummary } from "@niftygifty/types";
import { formatCurrency } from "@/lib/formatters";
import { useTheme } from "@/lib/theme";

interface StatRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail: string;
  color: string;
  last?: boolean;
}

function StatRow({ icon, label, value, detail, color, last }: StatRowProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{detail}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function GiftListStats({ summary }: { summary: GiftListSummary }) {
  const { colors } = useTheme();
  const hasGifts = summary.totalGifts > 0;
  const allAssigned = summary.unassignedGiftCount === 0;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <StatRow
        icon="checkmark-done-outline"
        label="Progress"
        value={`${hasGifts ? summary.completionPercent : 0}%`}
        detail={
          hasGifts ? `${summary.completedGiftCount}/${summary.totalGifts} done` : "No gifts yet"
        }
        color={colors.success}
      />
      <StatRow
        icon="cash-outline"
        label="Spend"
        value={formatCurrency(summary.totalCost) ?? "$0.00"}
        detail={
          summary.unpricedGiftCount === 0
            ? "All priced"
            : `${summary.unpricedGiftCount} missing a price`
        }
        color={colors.primary}
      />
      <StatRow
        icon="person-add-outline"
        label="Recipients"
        value={allAssigned ? "Ready" : `${summary.unassignedGiftCount} open`}
        detail={allAssigned ? "All assigned" : "Need recipients"}
        color={allAssigned ? colors.success : colors.warning}
        last
      />
    </View>
  );
}

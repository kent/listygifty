import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { GiftListSummary } from "@niftygifty/types";
import { formatCurrency } from "@/lib/formatters";
import { useTheme } from "@/lib/theme";

interface GiftListSummaryStripProps {
  summary: GiftListSummary;
  filteredSummary: GiftListSummary;
  hasActiveFilters: boolean;
}

interface SummaryTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail: string;
  color: string;
}

function SummaryTile({ icon, label, value, detail, color }: SummaryTileProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        minWidth: 132,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 12,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "600" }}>
          {label}
        </Text>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>
        {detail}
      </Text>
    </View>
  );
}

export function GiftListSummaryStrip({
  summary,
  filteredSummary,
  hasActiveFilters,
}: GiftListSummaryStripProps) {
  const { colors } = useTheme();
  const spend = formatCurrency(summary.totalCost) ?? "$0.00";
  const visibleSpend = formatCurrency(filteredSummary.totalCost) ?? "$0.00";
  const progressValue =
    summary.totalGifts === 0
      ? "0%"
      : `${summary.completionPercent}%`;
  const progressDetail =
    summary.totalGifts === 0
      ? "No gifts yet"
      : `${summary.completedGiftCount}/${summary.totalGifts} done`;
  const recipientValue =
    summary.unassignedGiftCount === 0 ? "Ready" : `${summary.unassignedGiftCount} open`;
  const recipientDetail =
    summary.unassignedGiftCount === 0
      ? "All assigned"
      : "Need recipients";
  const priceDetail =
    summary.unpricedGiftCount === 0
      ? "All priced"
      : `${summary.unpricedGiftCount} missing`;

  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      >
        <SummaryTile
          icon="checkmark-done-outline"
          label="Progress"
          value={progressValue}
          detail={progressDetail}
          color={colors.success}
        />
        <SummaryTile
          icon="cash-outline"
          label="Spend"
          value={spend}
          detail={priceDetail}
          color={colors.primary}
        />
        <SummaryTile
          icon="person-add-outline"
          label="Recipients"
          value={recipientValue}
          detail={recipientDetail}
          color={summary.unassignedGiftCount === 0 ? colors.success : colors.warning}
        />
      </ScrollView>

      {hasActiveFilters ? (
        <View
          style={{
            backgroundColor: colors.primarySurface,
            borderColor: colors.primary,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
            Visible: {filteredSummary.totalGifts} gift
            {filteredSummary.totalGifts === 1 ? "" : "s"} - {visibleSpend}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

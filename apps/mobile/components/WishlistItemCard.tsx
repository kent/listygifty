import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { WishlistItem } from "@niftygifty/types";
import { HapticPressable } from "@/components/HapticPressable";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/formatters";
import { openExternalUrl } from "@/lib/linking";

interface WishlistItemCardProps {
  item: WishlistItem;
  editable?: boolean;
  onDelete?: () => void;
  onPress?: () => void;
  /** Place in the owner's order, starting at 1. */
  rank?: number;
  total?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function WishlistItemCard({
  item,
  editable = false,
  onDelete,
  onPress,
  rank,
  total,
  onMoveUp,
  onMoveDown,
}: WishlistItemCardProps) {
  const { colors } = useTheme();
  // Older APIs send one price and no display string.
  const formattedPrice = item.price_display || formatCurrency(item.price);
  const canReorder = editable && rank !== undefined && total !== undefined && onMoveUp && onMoveDown;

  const handleOpenLink = async () => {
    if (item.link) {
      await openExternalUrl(item.link);
    }
  };

  const content = (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        {rank !== undefined ? (
          <View
            accessible
            accessibilityLabel={`Rank ${rank}`}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.surfaceSecondary,
              justifyContent: "center",
              alignItems: "center",
              alignSelf: "center",
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>{rank}</Text>
          </View>
        ) : null}

        {/* Photo or placeholder */}
        {item.photo_url ? (
          <Image
            source={{ uri: item.photo_url }}
            style={{
              width: 60,
              height: 60,
              borderRadius: 8,
              backgroundColor: colors.surfaceSecondary,
            }}
          />
        ) : (
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 8,
              backgroundColor: colors.surfaceSecondary,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="gift-outline" size={24} color={colors.muted} />
          </View>
        )}

        {/* Item details */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 2 }} numberOfLines={1}>
            {item.name}
          </Text>

          {item.description ? (
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 4 }} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
            {formattedPrice ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="cash-outline" size={14} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 12 }}>{formattedPrice}</Text>
              </View>
            ) : null}

            {item.link ? (
              <HapticPressable
                onPress={(event) => {
                  event.stopPropagation?.();
                  void handleOpenLink();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open link for ${item.name}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Ionicons name="link-outline" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12 }}>Open link</Text>
              </HapticPressable>
            ) : null}
          </View>
        </View>

        {canReorder ? (
          <View style={{ justifyContent: "center" }}>
            <HapticPressable
              onPress={(event) => {
                event?.stopPropagation?.();
                onMoveUp();
              }}
              disabled={rank === 1}
              accessibilityRole="button"
              accessibilityLabel={`Move ${item.name} up`}
              accessibilityState={{ disabled: rank === 1 }}
              style={{ padding: 4, opacity: rank === 1 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-up" size={22} color={colors.text} />
            </HapticPressable>
            <HapticPressable
              onPress={(event) => {
                event?.stopPropagation?.();
                onMoveDown();
              }}
              disabled={rank === total}
              accessibilityRole="button"
              accessibilityLabel={`Move ${item.name} down`}
              accessibilityState={{ disabled: rank === total }}
              style={{ padding: 4, opacity: rank === total ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-down" size={22} color={colors.text} />
            </HapticPressable>
          </View>
        ) : null}

        {/* Delete button for editable items */}
        {editable && onDelete ? (
          <HapticPressable
            onPress={(event) => {
              event.stopPropagation?.();
              onDelete();
            }}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            style={{ padding: 4 }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </HapticPressable>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <HapticPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open wishlist item ${item.name}`}
      >
        {content}
      </HapticPressable>
    );
  }

  return content;
}

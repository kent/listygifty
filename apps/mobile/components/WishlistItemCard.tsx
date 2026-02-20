import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { WishlistItem } from "@niftygifty/types";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/formatters";
import { openExternalUrl } from "@/lib/linking";

interface WishlistItemCardProps {
  item: WishlistItem;
  editable?: boolean;
  onDelete?: () => void;
  onPress?: () => void;
}

export function WishlistItemCard({ item, editable = false, onDelete, onPress }: WishlistItemCardProps) {
  const { colors } = useTheme();
  const formattedPrice = formatCurrency(item.price);

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
              <TouchableOpacity
                onPress={handleOpenLink}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Ionicons name="link-outline" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12 }}>Open link</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Delete button for editable items */}
        {editable && onDelete ? (
          <TouchableOpacity
            onPress={onDelete}
            style={{ padding: 4 }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

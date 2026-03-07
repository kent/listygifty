import { useRef } from "react";
import {
  View,
  Text,
  Animated,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import type { Gift } from "@niftygifty/types";
import { HapticPressable } from "@/components/HapticPressable";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";
import { getGiftStatusColors } from "@/lib/gift-status-colors";
import { formatCurrency } from "@/lib/formatters";
import { openExternalUrl } from "@/lib/linking";

interface GiftItemProps {
  item: Gift;
  onPress?: () => void;
  onDelete?: () => void;
}

export function GiftItem({ item, onPress, onDelete }: GiftItemProps) {
  const { colors, isDark } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const handleOpenLink = async () => {
    if (item.link) {
      await openExternalUrl(item.link);
    }
  };

  const statusColors = getGiftStatusColors(item.gift_status?.name || "", colors, isDark);

  const handleDelete = async () => {
    await haptics.medium();
    Alert.alert(
      "Delete Gift",
      `Are you sure you want to delete "${item.name}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            swipeableRef.current?.close();
            onDelete?.();
          },
        },
      ]
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <HapticPressable
        onPress={handleDelete}
        haptic="medium"
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.name}`}
        style={{
          backgroundColor: colors.error,
          justifyContent: "center",
          alignItems: "center",
          width: 80,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, marginTop: 4 }}>Delete</Text>
        </Animated.View>
      </HapticPressable>
    );
  };

  const content = (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 4 }}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={{ color: colors.textTertiary, fontSize: 14 }} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>

        {item.cost ? (
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600", marginLeft: 12 }}>
            {formatCurrency(item.cost)}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", marginTop: 12, gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {item.gift_status ? (
          <View
            style={{
              backgroundColor: statusColors.backgroundColor,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: statusColors.textColor, fontSize: 12, fontWeight: "500" }}>
              {item.gift_status.name}
            </Text>
          </View>
        ) : null}

        {item.recipients && item.recipients.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="person-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              For: {item.recipients.map((r) => r.name).join(", ")}
            </Text>
          </View>
        ) : null}

        {item.link ? (
          <HapticPressable
            onPress={(e) => {
              e.stopPropagation?.();
              void handleOpenLink();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open link for ${item.name}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13 }}>Link</Text>
          </HapticPressable>
        ) : null}

        {/* Edit indicator when tappable */}
        {onPress ? (
          <View style={{ marginLeft: "auto" }}>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
        ) : null}
      </View>
    </View>
  );

  // If we have delete capability, wrap in Swipeable
  if (onDelete) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
        onSwipeableWillOpen={() => {
          void haptics.selection();
        }}
      >
        {onPress ? (
          <HapticPressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Open gift ${item.name}`}
          >
            {content}
          </HapticPressable>
        ) : (
          content
        )}
      </Swipeable>
    );
  }

  // Just tappable
  if (onPress) {
    return (
      <HapticPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open gift ${item.name}`}
      >
        {content}
      </HapticPressable>
    );
  }

  return content;
}

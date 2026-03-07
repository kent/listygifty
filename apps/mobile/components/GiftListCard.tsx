import { useRef } from "react";
import { View, Text, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import type { Holiday } from "@niftygifty/types";
import { HapticPressable } from "@/components/HapticPressable";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";

interface GiftListCardProps {
  item: Holiday;
  onPress: () => void;
  onComplete?: () => void;
  onArchive?: () => void;
}

export function GiftListCard({ item, onPress, onComplete, onArchive }: GiftListCardProps) {
  const { colors, isDark } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleComplete = async () => {
    await haptics.medium();
    swipeableRef.current?.close();
    onComplete?.();
  };

  const handleArchive = async () => {
    await haptics.medium();
    swipeableRef.current?.close();
    onArchive?.();
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-160, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <View style={{ flexDirection: "row" }}>
        {/* Complete/Uncomplete */}
        {onComplete ? (
          <HapticPressable
            onPress={handleComplete}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel={`${item.completed ? "Reopen" : "Complete"} ${item.name}`}
            style={{
              backgroundColor: item.completed ? colors.warning : colors.success,
              justifyContent: "center",
              alignItems: "center",
              width: 80,
            }}
          >
            <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
              <Ionicons
                name={item.completed ? "refresh" : "checkmark-circle"}
                size={24}
                color="#fff"
              />
              <Text style={{ color: "#fff", fontSize: 11, marginTop: 4 }}>
                {item.completed ? "Reopen" : "Complete"}
              </Text>
            </Animated.View>
          </HapticPressable>
        ) : null}

        {/* Archive/Unarchive */}
        {onArchive ? (
          <HapticPressable
            onPress={handleArchive}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel={`${item.archived ? "Unarchive" : "Archive"} ${item.name}`}
            style={{
              backgroundColor: item.archived ? colors.primary : colors.muted,
              justifyContent: "center",
              alignItems: "center",
              width: 80,
              borderTopRightRadius: 12,
              borderBottomRightRadius: 12,
            }}
          >
            <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
              <Ionicons
                name={item.archived ? "arrow-undo" : "archive"}
                size={24}
                color="#fff"
              />
              <Text style={{ color: "#fff", fontSize: 11, marginTop: 4 }}>
                {item.archived ? "Unarchive" : "Archive"}
              </Text>
            </Animated.View>
          </HapticPressable>
        ) : null}
      </View>
    );
  };

  const content = (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open list ${item.name}`}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
              {item.name}
            </Text>
            {item.archived ? (
              <Ionicons name="archive" size={16} color={colors.muted} />
            ) : null}
          </View>
          {item.date ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {formatDate(item.date)}
              </Text>
            </View>
          ) : null}
        </View>

        {item.completed ? (
          <View
            style={{
              backgroundColor: isDark ? "#065f46" : "#dcfce7",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: isDark ? "#6ee7b7" : "#15803d", fontSize: 12, fontWeight: "500" }}>Done</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", marginTop: 12, gap: 16, alignItems: "center" }}>
        {item.collaborator_count > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="people-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {item.collaborator_count} collaborator{item.collaborator_count > 1 ? "s" : ""}
            </Text>
          </View>
        ) : null}

        {!item.is_owner ? (
          <View
            style={{
              backgroundColor: isDark ? "#1e1b4b" : "#f3e8ff",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: isDark ? "#a78bfa" : "#7c3aed", fontSize: 12 }}>Shared</Text>
          </View>
        ) : null}

        {/* Chevron indicator */}
        <View style={{ marginLeft: "auto" }}>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </View>
    </HapticPressable>
  );

  // Wrap in Swipeable if we have actions
  if (onComplete || onArchive) {
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
        {content}
      </Swipeable>
    );
  }

  return content;
}

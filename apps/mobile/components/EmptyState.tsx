import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { spacing, radius, typography } from "@/lib/design-tokens";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon,
  emoji,
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: compact ? spacing.xxl : spacing.huge,
        paddingHorizontal: spacing.xxl,
      }}
    >
      {emoji ? (
        <Text style={{ fontSize: compact ? 40 : 56, marginBottom: spacing.lg }}>{emoji}</Text>
      ) : icon ? (
        <View
          style={{
            width: compact ? 56 : 72,
            height: compact ? 56 : 72,
            borderRadius: radius.pill,
            backgroundColor: colors.primarySurface,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons name={icon} size={compact ? 28 : 36} color={colors.primary} />
        </View>
      ) : null}

      <Text
        style={{
          ...typography.subtitle,
          color: colors.text,
          textAlign: "center",
          marginBottom: message ? spacing.sm : spacing.lg,
        }}
      >
        {title}
      </Text>

      {message ? (
        <Text
          style={{
            ...typography.body,
            color: colors.textTertiary,
            textAlign: "center",
            marginBottom: spacing.lg,
            maxWidth: 320,
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            Haptics.selectionAsync();
            onAction();
          }}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.xxl,
            paddingVertical: spacing.md,
            borderRadius: radius.pill,
          }}
        >
          <Text style={{ ...typography.button, color: "#fff" }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

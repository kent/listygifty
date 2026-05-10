import { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
  ViewStyle,
  TextStyle,
  PressableProps,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { spacing, radius, typography, animation } from "@/lib/design-tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface PrimaryButtonProps extends Omit<PressableProps, "style" | "children"> {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  fullWidth = true,
  style,
  ...rest
}: PrimaryButtonProps) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const sizing: Record<Size, { paddingV: number; paddingH: number; fontSize: number; iconSize: number }> = {
    sm: { paddingV: spacing.sm, paddingH: spacing.lg, fontSize: 13, iconSize: 16 },
    md: { paddingV: spacing.md + 2, paddingH: spacing.xl, fontSize: 15, iconSize: 18 },
    lg: { paddingV: spacing.lg, paddingH: spacing.xxl, fontSize: 16, iconSize: 20 },
  };
  const s = sizing[size];

  const visual = (() => {
    if (variant === "primary") {
      return { background: colors.primary, foreground: "#ffffff", border: "transparent" };
    }
    if (variant === "secondary") {
      return { background: colors.surfaceSecondary, foreground: colors.text, border: colors.border };
    }
    if (variant === "danger") {
      return { background: colors.errorLight, foreground: colors.error, border: "transparent" };
    }
    return { background: "transparent", foreground: colors.primary, border: "transparent" };
  })();

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: animation.pressScale,
      duration: animation.pressDuration,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: animation.pressDuration,
      useNativeDriver: true,
    }).start();
  };
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const labelStyle: TextStyle = {
    ...typography.button,
    fontSize: s.fontSize,
    color: visual.foreground,
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale }], opacity: disabled ? 0.55 : 1, alignSelf: fullWidth ? "stretch" : "flex-start" },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={{
          backgroundColor: visual.background,
          borderColor: visual.border,
          borderWidth: variant === "secondary" ? 1 : 0,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          borderRadius: radius.lg,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
        }}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={visual.foreground} />
        ) : (
          <>
            {icon && iconPosition === "left" ? (
              <Ionicons name={icon} size={s.iconSize} color={visual.foreground} />
            ) : null}
            <Text style={labelStyle}>{label}</Text>
            {icon && iconPosition === "right" ? (
              <Ionicons name={icon} size={s.iconSize} color={visual.foreground} />
            ) : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: spacing.md }}>{children}</View>;
}

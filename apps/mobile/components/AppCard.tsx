import { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";
import { radius, spacing, shadow } from "@/lib/design-tokens";

interface AppCardProps {
  children: ReactNode;
  padding?: number;
  elevated?: boolean;
  style?: ViewStyle;
  variant?: "default" | "highlight";
}

export function AppCard({ children, padding = spacing.lg, elevated = false, style, variant = "default" }: AppCardProps) {
  const { colors } = useTheme();
  const isHighlight = variant === "highlight";

  return (
    <View
      style={[
        {
          backgroundColor: isHighlight ? colors.primarySurface : colors.card,
          borderRadius: radius.lg,
          padding,
          borderWidth: isHighlight ? 0 : 1,
          borderColor: colors.border,
        },
        elevated ? shadow.md : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

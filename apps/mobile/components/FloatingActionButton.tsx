import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

interface FloatingActionButtonProps {
  onPress: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  size?: number;
  label?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function FloatingActionButton({
  onPress,
  iconName = "add",
  size = 28,
  label,
  accessibilityLabel,
  style,
}: FloatingActionButtonProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? "Add"}
      style={{
        position: "absolute",
        right: 16,
        bottom: 24,
        backgroundColor: colors.primary,
        minWidth: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        paddingHorizontal: label ? 18 : 0,
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        ...style,
      }}
    >
      <Ionicons name={iconName} size={size} color={colors.textInverse} />
      {label ? <Text style={{ color: colors.textInverse, fontWeight: "600" }}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

import { Text, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { useTheme } from "@/lib/theme";

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  margin?: number;
}

export function InlineError({ message, onRetry, margin = 16 }: InlineErrorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        padding: 12,
        backgroundColor: colors.errorLight,
        margin,
        borderRadius: 8,
      }}
      >
        <Text style={{ color: colors.error }}>{message}</Text>
      {onRetry ? (
        <HapticPressable onPress={onRetry} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Retry</Text>
        </HapticPressable>
      ) : null}
    </View>
  );
}

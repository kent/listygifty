import { Text, TouchableOpacity, View } from "react-native";
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
        <TouchableOpacity onPress={onRetry} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

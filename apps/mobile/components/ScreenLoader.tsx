import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/lib/theme";

interface ScreenLoaderProps {
  fullScreen?: boolean;
}

export function ScreenLoader({ fullScreen = true }: ScreenLoaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        paddingVertical: fullScreen ? 0 : 20,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

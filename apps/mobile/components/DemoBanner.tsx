import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { endDemo } from "@/lib/demo-mode";
import { useTheme } from "@/lib/theme";

export function DemoBanner() {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.primarySurface }}>
      <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Demo mode</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Sample data only. No real invitations are sent. Changes reset when you leave.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Exit demo" onPress={endDemo} style={{ padding: 12 }}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Exit demo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

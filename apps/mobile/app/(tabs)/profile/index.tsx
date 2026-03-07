import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { useProfileController } from "@/lib/controllers";

export default function ProfileScreen() {
  const { colors, colorScheme, setColorScheme, isDark } = useTheme();
  const controller = useProfileController();

  const themeOptions: Array<{ value: "system" | "light" | "dark"; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: "system", label: "System", icon: "phone-portrait-outline" },
    { value: "light", label: "Light", icon: "sunny-outline" },
    { value: "dark", label: "Dark", icon: "moon-outline" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primarySurface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          <View>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>
              {controller.displayName || "User"}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
              {controller.email || "No email on file"}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 10, marginTop: 8, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="mail-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Primary email</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 13 }}>
            {controller.email || "No email address found"}
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>Appearance</Text>
          </View>
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Choose your preferred theme</Text>
        </View>
        <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
          {themeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => setColorScheme(option.value)}
              style={{
                flex: 1,
                backgroundColor: colorScheme === option.value ? colors.primary : colors.surfaceSecondary,
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Ionicons
                name={option.icon}
                size={20}
                color={colorScheme === option.value ? "#fff" : colors.muted}
              />
              <Text
                style={{
                  color: colorScheme === option.value ? "#fff" : colors.muted,
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={controller.promptSignOut}
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 16,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="log-out-outline" size={18} color={isDark ? "#fca5a5" : "#dc2626"} />
          <Text style={{ color: isDark ? "#fca5a5" : "#dc2626", fontSize: 16, fontWeight: "600" }}>
            Sign Out
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={isDark ? "#fca5a5" : "#dc2626"} />
      </TouchableOpacity>
    </ScrollView>
  );
}

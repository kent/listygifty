import { useState } from "react";
import { AccessibilityInfo, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { AppCard } from "@/components/AppCard";
import { fontSize, fontWeight, radius, spacing } from "@/lib/design-tokens";
import { MCP_SERVER_URL } from "@/lib/mcp";
import { useTheme } from "@/lib/theme";

type CopyStatus = "idle" | "copied" | "error";

export function McpOAuthUrlCard() {
  const { colors } = useTheme();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const copyUrl = async () => {
    try {
      await Clipboard.setStringAsync(MCP_SERVER_URL);
      setCopyStatus("copied");
      AccessibilityInfo.announceForAccessibility("MCP OAuth URL copied");
    } catch {
      setCopyStatus("error");
      AccessibilityInfo.announceForAccessibility("Could not copy the MCP OAuth URL. Select the URL to copy it manually.");
    }
  };

  const copyLabel = copyStatus === "copied"
    ? "MCP OAuth URL copied"
    : copyStatus === "error"
      ? "Copy MCP OAuth URL failed. Try again"
      : "Copy MCP OAuth URL";

  return (
    <AppCard variant="highlight" style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="link-outline" size={22} color="#ffffff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontSize: fontSize.bodyLarge, fontWeight: fontWeight.semibold }}>
              Your MCP OAuth URL
            </Text>
            <View
              style={{
                borderRadius: radius.pill,
                backgroundColor: colors.infoLight,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              <Text style={{ color: colors.infoText, fontSize: fontSize.caption, fontWeight: fontWeight.semibold }}>
                OAuth 2.1
              </Text>
            </View>
          </View>
          <Text style={{ marginTop: spacing.xs, color: colors.textSecondary, fontSize: fontSize.body, lineHeight: 20 }}>
            Paste this server URL into an OAuth-capable MCP client. Sign-in limits access to your account and approved permissions.
          </Text>
        </View>
      </View>

      <View
        style={{
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Text
          style={{ color: colors.textTertiary, fontSize: fontSize.caption, fontWeight: fontWeight.semibold }}
        >
          SERVER URL
        </Text>
        <Text
          testID="mcp-oauth-url"
          selectable
          style={{ color: colors.infoText, fontSize: fontSize.body, fontWeight: fontWeight.semibold, lineHeight: 20 }}
        >
          {MCP_SERVER_URL}
        </Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={copyLabel}
        accessibilityHint="Copies the Listy Gifty MCP server URL to the clipboard"
        onPress={copyUrl}
        style={{
          minHeight: 44,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
        }}
      >
        <Ionicons
          name={copyStatus === "copied" ? "checkmark-circle-outline" : copyStatus === "error" ? "alert-circle-outline" : "copy-outline"}
          size={18}
          color="#ffffff"
        />
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#ffffff", fontSize: fontSize.body, fontWeight: fontWeight.semibold }}
        >
          {copyStatus === "copied" ? "URL copied" : copyStatus === "error" ? "Copy failed — try again" : "Copy URL"}
        </Text>
      </TouchableOpacity>
    </AppCard>
  );
}

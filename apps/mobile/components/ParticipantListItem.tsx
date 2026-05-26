import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ExchangeParticipant } from "@niftygifty/types";
import { useTheme } from "@/lib/theme";

interface ParticipantListItemProps {
  participant: ExchangeParticipant;
  onCopyInvite?: () => void;
  onShareInvite?: () => void;
  showWishlistCount?: boolean;
}

export function ParticipantListItem({
  participant,
  onCopyInvite,
  onShareInvite,
  showWishlistCount = false,
}: ParticipantListItemProps) {
  const { colors, isDark } = useTheme();

  const statusIcons: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    accepted: { name: "checkmark-circle", color: colors.success },
    declined: { name: "close-circle", color: colors.error },
    invited: { name: "time", color: colors.warning },
  };

  const statusIcon = statusIcons[participant.status] || statusIcons.invited;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Ionicons name={statusIcon.name} size={20} color={statusIcon.color} />

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>
          {participant.display_name || participant.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
          {participant.email}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {showWishlistCount && participant.wishlist_count > 0 ? (
          <View
            style={{
              backgroundColor: isDark ? "#4c1d95" : "#f3e8ff",
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: isDark ? "#a78bfa" : "#7c3aed",
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {participant.wishlist_count} items
            </Text>
          </View>
        ) : null}

        {onCopyInvite ? (
          <TouchableOpacity
            onPress={onCopyInvite}
            accessibilityRole="button"
            accessibilityLabel={`Copy invite for ${participant.display_name || participant.name}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Ionicons name="copy-outline" size={14} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "700" }}>
              Copy
            </Text>
          </TouchableOpacity>
        ) : null}

        {onShareInvite ? (
          <TouchableOpacity
            onPress={onShareInvite}
            accessibilityRole="button"
            accessibilityLabel={`Share invite for ${participant.display_name || participant.name}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: colors.primarySurface,
            }}
          >
            <Ionicons name="share-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
              Share
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

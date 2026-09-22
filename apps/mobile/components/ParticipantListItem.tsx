import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ExchangeParticipant } from "@niftygifty/types";
import { useTheme } from "@/lib/theme";

interface ParticipantListItemProps {
  participant: ExchangeParticipant;
  onCopyInvite?: () => void;
  onShareInvite?: () => void;
  onReinvite?: () => void;
  reinviteDisabled?: boolean;
  showWishlistCount?: boolean;
}

export function ParticipantListItem({
  participant,
  onCopyInvite,
  onShareInvite,
  onReinvite,
  reinviteDisabled = false,
  showWishlistCount = false,
}: ParticipantListItemProps) {
  const { colors, isDark } = useTheme();

  const statusIcons: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    accepted: { name: "checkmark-circle", color: colors.success },
    declined: { name: "close-circle", color: colors.error },
    invited: { name: "time", color: colors.warning },
  };

  const statusIcon = statusIcons[participant.status] || statusIcons.invited;
  const statusLabel =
    participant.status === "accepted"
      ? "Joined"
      : participant.status === "declined"
        ? "Declined"
        : "Needs to join";

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
        {participant.email ? (
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
            {participant.email}
          </Text>
        ) : null}
        <Text style={{ color: statusIcon.color, fontSize: 12 }}>{statusLabel}</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {onReinvite && participant.status === "declined" ? (
          <TouchableOpacity
            onPress={onReinvite}
            disabled={reinviteDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Invite ${participant.display_name || participant.name} again`}
            style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8, opacity: reinviteDisabled ? 0.5 : 1 }}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Invite again</Text>
          </TouchableOpacity>
        ) : null}
        {showWishlistCount && participant.status === "accepted" ? (
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
              {participant.wishlist_count === 0 ? "No ideas yet" : `${participant.wishlist_count} ${participant.wishlist_count === 1 ? "idea" : "ideas"}`}
            </Text>
          </View>
        ) : null}

        {onCopyInvite && participant.status === "invited" ? (
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
              paddingVertical: 10,
              minHeight: 44,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Ionicons name="copy-outline" size={14} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "700" }}>
              Copy
            </Text>
          </TouchableOpacity>
        ) : null}

        {onShareInvite && participant.status === "invited" ? (
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
              paddingVertical: 10,
              minHeight: 44,
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

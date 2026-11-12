import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ExchangeNotification } from "@niftygifty/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/lib/theme";

interface WishlistRequestsSectionProps {
  requests: ExchangeNotification[];
  answeringRequestId: number | null;
  onAnswer: (notification: ExchangeNotification, approve: boolean) => void;
}

// Anonymous requests to see your wishlist that are waiting on you.
export function WishlistRequestsSection({ requests, answeringRequestId, onAnswer }: WishlistRequestsSectionProps) {
  const { colors } = useTheme();
  if (requests.length === 0) return null;

  return (
    <View
      testID="wishlist-requests"
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary,
        padding: 16,
        marginBottom: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="eye-outline" size={20} color={colors.primary} />
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
          Wishlist requests
        </Text>
      </View>
      {requests.map((notification) => {
        const request = notification.wishlist_access_request;
        if (!request) return null;
        const answering = answeringRequestId === request.id;
        const busy = answeringRequestId !== null;

        return (
          <View key={notification.id} style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 14 }}>{notification.message}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PrimaryButton
                label="Say yes"
                icon="checkmark"
                size="sm"
                fullWidth={false}
                style={{ flex: 1 }}
                onPress={() => onAnswer(notification, true)}
                loading={answering}
                disabled={busy}
                accessibilityLabel="Let them see your wishlist"
              />
              <PrimaryButton
                label="Say no"
                icon="close"
                size="sm"
                variant="secondary"
                fullWidth={false}
                style={{ flex: 1 }}
                onPress={() => onAnswer(notification, false)}
                disabled={busy}
                accessibilityLabel="Keep your wishlist private"
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

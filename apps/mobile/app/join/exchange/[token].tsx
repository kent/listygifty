import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenLoader } from "@/components/ScreenLoader";
import { formatBudgetRange, formatLongDate } from "@/lib/formatters";
import { useTheme } from "@/lib/theme";
import { useExchangeInviteController } from "@/lib/controllers";

export default function ExchangeInviteScreen() {
  const { colors, isDark } = useTheme();
  const controller = useExchangeInviteController();
  const invite = controller.invite;
  const formattedExchangeDate = formatLongDate(invite?.exchange.exchange_date);
  const formattedBudgetRange = formatBudgetRange(
    invite?.exchange.budget_min,
    invite?.exchange.budget_max
  );

  if (controller.loading) {
    return <ScreenLoader />;
  }

  if (controller.error || !invite) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 32,
        }}
      >
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text
          style={{
            color: colors.error,
            fontSize: 18,
            fontWeight: "600",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {controller.error || "Invite not found"}
        </Text>
        <TouchableOpacity onPress={controller.routeToExchanges} style={{ marginTop: 24 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>Go to Exchanges</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (invite.participant.status !== "invited") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 32,
        }}
      >
        <Ionicons
          name={invite.participant.status === "accepted" ? "checkmark-circle" : "close-circle"}
          size={64}
          color={invite.participant.status === "accepted" ? colors.success : colors.error}
        />
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: "600",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {invite.participant.status === "accepted"
            ? "You've already accepted this invitation!"
            : "You've declined this invitation"}
        </Text>
        <TouchableOpacity
          onPress={() => controller.routeToExchange(invite.exchange.id)}
          style={{ marginTop: 24 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>View Exchange</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
      }}
    >
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 24,
          fontWeight: "700",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        You're Invited!
      </Text>
      <Text
        style={{
          color: colors.textTertiary,
          fontSize: 16,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        {invite.exchange.owner_name} has invited you to join a gift exchange
      </Text>

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          width: "100%",
          marginBottom: 32,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: "600",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {invite.exchange.name}
        </Text>

        {formattedExchangeDate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{formattedExchangeDate}</Text>
          </View>
        ) : null}

        {formattedBudgetRange ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ionicons name="cash-outline" size={20} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 14 }}>
              Budget: {formattedBudgetRange}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
            Organized by {invite.exchange.owner_name}
          </Text>
        </View>
      </View>

      {controller.isSignedIn ? (
        <View style={{ width: "100%", gap: 12 }}>
          <TouchableOpacity
            onPress={controller.handleAccept}
            disabled={controller.actionLoading}
            style={{
              backgroundColor: colors.success,
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            {controller.actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                Accept Invitation
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={controller.handleDecline}
            disabled={controller.actionLoading}
            style={{
              backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: isDark ? "#fca5a5" : "#dc2626",
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Decline
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ width: "100%", gap: 16 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center" }}>
            Sign in to respond to this invitation
          </Text>

          <Link href="/auth/login" asChild>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Sign In</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/auth/signup" asChild>
            <TouchableOpacity
              style={{
                backgroundColor: colors.card,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                Create Account
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
    </ScrollView>
  );
}

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useServices } from "@/lib/use-api";
import { useTheme } from "@/lib/theme";
import type { ExchangeInviteDetails } from "@niftygifty/types";
import { ScreenLoader } from "@/components/ScreenLoader";
import { formatBudgetRange, formatLongDate } from "@/lib/formatters";

export default function ExchangeInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { exchangeInvites } = useServices();
  const { colors, isDark } = useTheme();

  const [invite, setInvite] = useState<ExchangeInviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formattedExchangeDate = formatLongDate(invite?.exchange.exchange_date);
  const formattedBudgetRange = formatBudgetRange(invite?.exchange.budget_min, invite?.exchange.budget_max);

  const fetchInvite = useCallback(async () => {
    if (!token) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await exchangeInvites.getByToken(token);
      setInvite(data);
    } catch (err) {
      setError("This invite link is invalid or has expired");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, exchangeInvites]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  const handleAccept = async () => {
    if (!token) return;

    setActionLoading(true);
    try {
      const result = await exchangeInvites.accept(token);
      // Navigate to the exchange detail
      router.replace(`/(tabs)/exchanges/${result.exchange.id}`);
    } catch (err) {
      setError("Failed to accept invitation");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;

    setActionLoading(true);
    try {
      await exchangeInvites.decline(token);
      // Navigate to exchanges list
      router.replace("/(tabs)/exchanges");
    } catch (err) {
      setError("Failed to decline invitation");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !isLoaded) {
    return <ScreenLoader />;
  }

  if (error || !invite) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text style={{ color: colors.error, fontSize: 18, fontWeight: "600", marginTop: 16, textAlign: "center" }}>
          {error || "Invite not found"}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/exchanges")}
          style={{ marginTop: 24 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>Go to Exchanges</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Check if already responded
  if (invite.participant.status !== "invited") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <Ionicons
          name={invite.participant.status === "accepted" ? "checkmark-circle" : "close-circle"}
          size={64}
          color={invite.participant.status === "accepted" ? colors.success : colors.error}
        />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginTop: 16, textAlign: "center" }}>
          {invite.participant.status === "accepted"
            ? "You've already accepted this invitation!"
            : "You've declined this invitation"}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace(`/(tabs)/exchanges/${invite.exchange.id}`)}
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
      contentContainerStyle={{ padding: 24, alignItems: "center", justifyContent: "center", minHeight: "100%" }}
    >
      {/* Invitation Header */}
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
        You're Invited!
      </Text>
      <Text style={{ color: colors.textTertiary, fontSize: 16, textAlign: "center", marginBottom: 32 }}>
        {invite.exchange.owner_name} has invited you to join a gift exchange
      </Text>

      {/* Exchange Details Card */}
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
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600", marginBottom: 16, textAlign: "center" }}>
          {invite.exchange.name}
        </Text>

        {formattedExchangeDate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
              {formattedExchangeDate}
            </Text>
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

      {/* Action Buttons - Only show if signed in */}
      {isSignedIn ? (
        <View style={{ width: "100%", gap: 12 }}>
          <TouchableOpacity
            onPress={handleAccept}
            disabled={actionLoading}
            style={{
              backgroundColor: colors.success,
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Accept Invitation</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDecline}
            disabled={actionLoading}
            style={{
              backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: isDark ? "#fca5a5" : "#dc2626", fontSize: 16, fontWeight: "600" }}>Decline</Text>
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
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
    </ScrollView>
  );
}

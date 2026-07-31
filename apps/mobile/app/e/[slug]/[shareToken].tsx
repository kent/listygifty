import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { InlineError } from "@/components/InlineError";
import { ScreenLoader } from "@/components/ScreenLoader";
import { formatBudgetRange, formatLongDate } from "@/lib/formatters";
import { useExchangeShareJoinController } from "@/lib/controllers";
import { useTheme } from "@/lib/theme";

export default function SharedExchangeJoinScreen() {
  const { colors } = useTheme();
  const controller = useExchangeShareJoinController();
  const details = controller.details;

  if (controller.loading) {
    return <ScreenLoader />;
  }

  if (controller.error || !details) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: colors.background,
          padding: 24,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <Ionicons name="link-outline" size={56} color={colors.error} />
          <Text
            style={{
              color: colors.text,
              fontSize: 22,
              fontWeight: "700",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            This link is not available
          </Text>
        </View>
        <InlineError
          message={controller.error || "This join link is invalid or has expired."}
          onRetry={controller.retryLoad}
          margin={0}
        />
        <TouchableOpacity
          onPress={controller.routeToExchanges}
          style={{ alignItems: "center", padding: 16, marginTop: 8 }}
        >
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>
            Go to Exchanges
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const exchangeDate = formatLongDate(details.exchange.exchange_date);
  const budget = formatBudgetRange(
    details.exchange.budget_min,
    details.exchange.budget_max
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySurface,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 36 }}>🎁</Text>
        </View>
        <Text
          style={{
            color: colors.primary,
            fontSize: 13,
            fontWeight: "700",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          You&apos;re invited
        </Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 28,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          {details.exchange.name}
        </Text>
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: 15,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          Organized by {details.exchange.owner_name}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 18,
          gap: 14,
          marginBottom: 20,
        }}
      >
        {exchangeDate ? (
          <DetailRow
            icon="calendar-outline"
            text={exchangeDate}
            color={colors.textTertiary}
          />
        ) : null}
        {budget ? (
          <DetailRow
            icon="cash-outline"
            text={`Budget: ${budget}`}
            color={colors.success}
          />
        ) : null}
        <DetailRow
          icon="people-outline"
          text={`${details.exchange.accepted_count} ${
            details.exchange.accepted_count === 1 ? "person" : "people"
          } already in`}
          color={colors.textTertiary}
        />
      </View>

      {!details.join_open ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            alignItems: "center",
          }}
        >
          <Ionicons name="lock-closed-outline" size={30} color={colors.muted} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 10 }}>
            This exchange is closed
          </Text>
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 14,
              lineHeight: 20,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {details.closed_reason || "This exchange is no longer accepting new people."}
          </Text>
        </View>
      ) : controller.isSignedIn ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
            Your name in this exchange
          </Text>
          <TextInput
            value={controller.name}
            onChangeText={controller.setName}
            placeholder="How should we introduce you?"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              color: colors.text,
              fontSize: 16,
              padding: 15,
            }}
          />
          {controller.actionError ? (
            <InlineError message={controller.actionError} margin={0} />
          ) : null}
          <TouchableOpacity
            onPress={controller.handleJoin}
            disabled={controller.joining}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: controller.joining ? 0.7 : 1,
            }}
          >
            {controller.joining ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.textInverse} />
            )}
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "700" }}>
              {controller.joining ? "Joining…" : "Join Exchange"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 14,
              lineHeight: 20,
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            Sign in or create an account. We&apos;ll bring you back here to confirm.
          </Text>
          <TouchableOpacity
            onPress={controller.routeToLogin}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: "700" }}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={controller.routeToSignup}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({
  icon,
  text,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color, fontSize: 14, flex: 1 }}>{text}</Text>
    </View>
  );
}

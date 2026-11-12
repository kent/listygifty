import { View, Text, ScrollView, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MatchRevealCard } from "@/components/MatchRevealCard";
import { MatchWishlistSection } from "@/components/MatchWishlistSection";
import { PrimaryButton } from "@/components/PrimaryButton";
import { InlineError } from "@/components/InlineError";
import { ScreenLoader } from "@/components/ScreenLoader";
import { canSeeWishlist, getClosedWishlistCopy, type WishlistAccess } from "@/lib/models";
import { useTheme } from "@/lib/theme";
import { useExchangeParticipantController } from "@/lib/controllers";

const CLOSED_ICONS: Partial<Record<WishlistAccess, keyof typeof Ionicons.glyphMap>> = {
  pending: "time-outline",
  unavailable: "person-outline",
};

export default function ExchangeParticipantScreen() {
  const { colors } = useTheme();
  const controller = useExchangeParticipantController();
  const { access, exchange, participant } = controller;

  if (controller.loading) {
    return <ScreenLoader />;
  }

  if (!exchange || !participant) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 32 }}>
        <InlineError message={controller.error || "We couldn't find this person."} onRetry={controller.retryLoad} />
      </View>
    );
  }

  const name = participant.display_name || participant.name;
  const closed = getClosedWishlistCopy(access, name);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={controller.refreshing} onRefresh={controller.triggerRefresh} tintColor={colors.primary} />
      }
    >
      <Stack.Screen options={{ title: name }} />

      {access === "own" ? (
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, gap: 12, alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>This is you.</Text>
          <PrimaryButton label="Edit your wishlist" icon="list-outline" onPress={controller.goToMyWishlist} />
        </View>
      ) : canSeeWishlist(access) ? (
        <>
          {access === "match" ? (
            <MatchRevealCard
              matchName={name}
              exchangeDate={exchange.exchange_date}
              budgetMin={exchange.budget_min}
              budgetMax={exchange.budget_max}
            />
          ) : null}
          <MatchWishlistSection
            matchName={name}
            items={participant.wishlist_items ?? []}
            nudge={access === "match" ? controller.nudge : { ...controller.nudge, canNudge: false }}
            demo={controller.demo}
          />
        </>
      ) : (
        <View
          testID="closed-wishlist"
          style={{
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 24,
            paddingHorizontal: 20,
            gap: 8,
          }}
        >
          <Ionicons name={CLOSED_ICONS[access] ?? "lock-closed-outline"} size={32} color={colors.textTertiary} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", textAlign: "center" }}>{closed.title}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center", marginBottom: 8 }}>
            {closed.body}
          </Text>
          {access === "none" ? (
            <View style={{ width: "100%", gap: 10 }}>
              <PrimaryButton
                label="Ask to see their wishlist"
                icon="mail-outline"
                onPress={controller.askForWishlist}
                loading={controller.asking}
              />
              {controller.demo ? (
                <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: "center" }}>
                  This demo simulates the request. Nothing is sent.
                </Text>
              ) : null}
              {controller.askError ? <InlineError message={controller.askError} margin={0} /> : null}
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

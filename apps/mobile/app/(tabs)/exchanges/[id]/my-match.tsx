import { View, Text, ScrollView, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { MatchRevealCard } from "@/components/MatchRevealCard";
import { MatchWishlistSection } from "@/components/MatchWishlistSection";
import { InlineError } from "@/components/InlineError";
import { ScreenLoader } from "@/components/ScreenLoader";
import { useTheme } from "@/lib/theme";
import { useExchangeMatchController } from "@/lib/controllers";

export default function MyMatchScreen() {
  const { colors } = useTheme();
  const controller = useExchangeMatchController();
  const matchedParticipant = controller.exchange?.my_participant?.matched_participant;

  if (controller.loading) {
    return <ScreenLoader />;
  }

  if (!controller.exchange || !matchedParticipant) {
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
        <InlineError message={controller.error || "Your match isn't ready yet. Come back after the organizer draws names."} onRetry={controller.retryLoad} />
      </View>
    );
  }

  const matchName = matchedParticipant.display_name || matchedParticipant.name;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={controller.refreshing}
          onRefresh={controller.triggerRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: "Your Match" }} />

      <MatchRevealCard
        matchName={matchName}
        exchangeDate={controller.exchange.exchange_date}
        budgetMin={controller.exchange.budget_min}
        budgetMax={controller.exchange.budget_max}
      />

      <View style={{ marginTop: 24 }}>
        <MatchWishlistSection
          matchName={matchName}
          items={controller.matchWishlist}
          nudge={controller.nudge}
          demo={controller.demo}
        />
      </View>

      <View style={{ marginTop: 24, alignItems: "center", paddingBottom: 32 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Remember: Keep your match a secret! 🤫
        </Text>
      </View>
    </ScrollView>
  );
}

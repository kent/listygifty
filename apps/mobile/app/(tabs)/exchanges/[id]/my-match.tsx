import { View, Text, FlatList, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { MatchRevealCard } from "@/components/MatchRevealCard";
import { WishlistItemCard } from "@/components/WishlistItemCard";
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
        <Text style={{ color: colors.error, fontSize: 16, textAlign: "center" }}>
          {controller.error || "Match not found. The exchange may not have started yet."}
        </Text>
      </View>
    );
  }

  const matchName = matchedParticipant.display_name || matchedParticipant.name;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Your Match" }} />

      <FlatList
        data={controller.matchWishlist}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={controller.triggerRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 24 }}>
            <MatchRevealCard
              matchName={matchName}
              exchangeDate={controller.exchange.exchange_date}
              budgetMin={controller.exchange.budget_min}
              budgetMax={controller.exchange.budget_max}
            />

            <View style={{ marginTop: 24, marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 4 }}>
                {matchName}'s Wishlist
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {controller.matchWishlist.length} item
                {controller.matchWishlist.length !== 1 ? "s" : ""} to choose from
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: 12 }}>
            <WishlistItemCard item={item} />
          </View>
        )}
        ListEmptyComponent={
          <View
            style={{
              alignItems: "center",
              paddingVertical: 32,
              backgroundColor: colors.card,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📝</Text>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 14,
                textAlign: "center",
                paddingHorizontal: 24,
              }}
            >
              {matchName} hasn't added any items to their wishlist yet. Check back later for gift
              ideas!
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ marginTop: 24, alignItems: "center", paddingBottom: 32 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Remember: Keep your match a secret! 🤫
            </Text>
          </View>
        }
      />
    </View>
  );
}

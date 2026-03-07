import { View, Text, RefreshControl, SectionList } from "react-native";
import { ExchangeCard } from "@/components/ExchangeCard";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { useTheme } from "@/lib/theme";
import { useExchangesController } from "@/lib/controllers";

export default function ExchangesScreen() {
  const { colors } = useTheme();
  const controller = useExchangesController();

  if (controller.loading) {
    return <ScreenLoader />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {controller.error ? (
        <InlineError message={controller.error} onRetry={controller.retryLoad} margin={16} />
      ) : null}

      <SectionList
        sections={controller.sections}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={controller.triggerRefresh}
            tintColor={colors.primary}
          />
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 14,
              fontWeight: "600",
              marginBottom: 12,
              marginTop: title === "Participating In" ? 24 : 0,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {title}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={{ marginBottom: 12 }}>
            <ExchangeCard
              exchange={item}
              onPress={() => controller.handlePressExchange(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              No Exchanges Yet
            </Text>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 14,
                textAlign: "center",
                paddingHorizontal: 32,
              }}
            >
              You'll see exchanges here when someone invites you to participate in a gift exchange.
            </Text>
          </View>
        }
      />
    </View>
  );
}

import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { Stack } from "expo-router";
import { WishlistItemCard } from "@/components/WishlistItemCard";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { useTheme } from "@/lib/theme";
import { useExchangeWishlistController } from "@/lib/controllers";

export default function MyWishlistScreen() {
  const { colors } = useTheme();
  const controller = useExchangeWishlistController();

  if (controller.loading) {
    return <ScreenLoader />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "My Wishlist" }} />

      {controller.error ? (
        <InlineError message={controller.error} onRetry={controller.retryLoad} margin={16} />
      ) : null}

      <FlatList
        data={controller.items}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={controller.triggerRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <WishlistItemCard
            item={item}
            editable
            onDelete={() => controller.handleDeleteItem(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              Your Wishlist is Empty
            </Text>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 14,
                textAlign: "center",
                marginBottom: 24,
                paddingHorizontal: 32,
              }}
            >
              Add items to help your Secret Santa find the perfect gift for you!
            </Text>
            <TouchableOpacity
              onPress={controller.handleAddItem}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.textInverse, fontWeight: "600" }}>
                Add Your First Item
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={
          controller.items.length > 0 ? (
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
              {controller.items.length} item{controller.items.length !== 1 ? "s" : ""} in your
              wishlist
            </Text>
          ) : null
        }
      />

      {controller.items.length > 0 ? (
        <FloatingActionButton
          onPress={controller.handleAddItem}
          accessibilityLabel="Add Wishlist Item"
        />
      ) : null}
    </View>
  );
}

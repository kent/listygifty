import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useServices } from "@/lib/use-api";
import { useTheme } from "@/lib/theme";
import type { GiftExchangeWithParticipants, WishlistItem } from "@niftygifty/types";
import { WishlistItemCard } from "@/components/WishlistItemCard";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";

export default function MyWishlistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { giftExchanges, wishlistItems } = useServices();
  const { colors } = useTheme();

  const [exchange, setExchange] = useState<GiftExchangeWithParticipants | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exchangeId = parseInt(id, 10);
  const myParticipant = exchange?.my_participant;

  const fetchData = useCallback(async () => {
    if (isNaN(exchangeId)) {
      setError("Invalid exchange ID");
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // First get exchange to find our participant ID
      const exchangeData = await giftExchanges.getById(exchangeId);
      setExchange(exchangeData);

      // Then fetch wishlist items for our participant
      if (exchangeData.my_participant) {
        const wishlistData = await wishlistItems.getAll(
          exchangeId,
          exchangeData.my_participant.id
        );
        setItems(wishlistData);
      }
    } catch (err) {
      setError("Failed to load wishlist");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [exchangeId, giftExchanges, wishlistItems]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleAddItem = () => {
    router.push({
      pathname: "/(tabs)/exchanges/wishlist/new",
      params: { exchange_id: exchangeId.toString(), participant_id: myParticipant?.id.toString() },
    });
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!myParticipant) return;

    Alert.alert(
      "Delete Item",
      "Are you sure you want to remove this item from your wishlist?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await wishlistItems.delete(exchangeId, myParticipant.id, itemId);
              setItems((prev) => prev.filter((item) => item.id !== itemId));
            } catch (err) {
              Alert.alert("Error", "Failed to delete item");
              console.error(err);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "My Wishlist" }} />

      {error ? (
        <InlineError message={error} onRetry={fetchData} margin={16} />
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <WishlistItemCard
            item={item}
            editable
            onDelete={() => handleDeleteItem(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              Your Wishlist is Empty
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: "center", marginBottom: 24, paddingHorizontal: 32 }}>
              Add items to help your Secret Santa find the perfect gift for you!
            </Text>
            <TouchableOpacity
              onPress={handleAddItem}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.textInverse, fontWeight: "600" }}>Add Your First Item</Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 8 }}>
              {items.length} item{items.length !== 1 ? "s" : ""} in your wishlist
            </Text>
          ) : null
        }
      />

      {/* FAB to add items */}
      {items.length > 0 ? (
        <FloatingActionButton onPress={handleAddItem} accessibilityLabel="Add Wishlist Item" />
      ) : null}
    </View>
  );
}

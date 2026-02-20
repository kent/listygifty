import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useServices } from "@/lib/use-api";
import { useTheme } from "@/lib/theme";
import type { Holiday } from "@niftygifty/types";
import { GiftListCard } from "@/components/GiftListCard";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";

export default function GiftListsScreen() {
  const router = useRouter();
  const { holidays } = useServices();
  const { colors } = useTheme();

  const [lists, setLists] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    try {
      setError(null);
      const data = await holidays.getAll();
      setLists(data);
    } catch (err) {
      setError("Failed to load gift lists");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [holidays]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLists();
  }, [fetchLists]);

  const handlePressItem = (item: Holiday) => {
    router.push(`/(tabs)/lists/${item.id}`);
  };

  const handleAddList = () => {
    router.push("/(tabs)/lists/new");
  };

  const handleComplete = async (item: Holiday) => {
    try {
      const newCompleted = !item.completed;
      await holidays.update(item.id, { completed: newCompleted });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLists((prev) =>
        prev.map((list) =>
          list.id === item.id ? { ...list, completed: newCompleted } : list
        )
      );
    } catch (err) {
      console.error("Failed to update list", err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleArchive = async (item: Holiday) => {
    try {
      const newArchived = !item.archived;
      await holidays.update(item.id, { archived: newArchived });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLists((prev) =>
        prev.map((list) =>
          list.id === item.id ? { ...list, archived: newArchived } : list
        )
      );
    } catch (err) {
      console.error("Failed to archive list", err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {error ? (
        <InlineError message={error} onRetry={fetchLists} margin={16} />
      ) : null}

      <FlatList
        data={lists}
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
          <GiftListCard
            item={item}
            onPress={() => handlePressItem(item)}
            onComplete={item.is_owner ? () => handleComplete(item) : undefined}
            onArchive={item.is_owner ? () => handleArchive(item) : undefined}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              No Gift Lists Yet
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 24, textAlign: "center", paddingHorizontal: 32 }}>
              Create your first list to start organizing gifts for any occasion.
            </Text>
            <TouchableOpacity
              onPress={handleAddList}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.textInverse, fontWeight: "600" }}>Create Your First List</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {lists.length > 0 ? (
        <FloatingActionButton onPress={handleAddList} accessibilityLabel="Add List" />
      ) : null}
    </GestureHandlerRootView>
  );
}

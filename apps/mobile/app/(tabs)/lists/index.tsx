import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GiftListCard } from "@/components/GiftListCard";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { useTheme } from "@/lib/theme";
import { useGiftListsController } from "@/lib/controllers";
import { LIST_SECTION_OPTIONS } from "@/lib/models";

export default function GiftListsScreen() {
  const { colors } = useTheme();
  const controller = useGiftListsController();

  if (controller.loading) {
    return <ScreenLoader />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {controller.error ? (
        <InlineError message={controller.error} onRetry={controller.retryLoad} margin={16} />
      ) : null}

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surfaceSecondary,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 4,
            gap: 4,
          }}
        >
          {LIST_SECTION_OPTIONS.map((section) => {
            const isActive = controller.activeSection === section.key;
            return (
              <TouchableOpacity
                key={section.key}
                onPress={() => controller.setActiveSection(section.key)}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  backgroundColor: isActive ? colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: isActive ? "#fff" : colors.textTertiary,
                    fontSize: 13,
                    fontWeight: isActive ? "600" : "500",
                  }}
                >
                  {section.label}
                </Text>
                <Text
                  style={{
                    color: isActive ? "#fff" : colors.muted,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {controller.sectionCounts[section.key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={controller.filteredLists}
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
          <GiftListCard
            item={item}
            onPress={() => controller.handlePressItem(item)}
            onComplete={item.is_owner ? () => controller.handleComplete(item) : undefined}
            onArchive={item.is_owner ? () => controller.handleArchive(item) : undefined}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              {controller.totalLists === 0 ? "No Gift Lists Yet" : "No Lists in This Section"}
            </Text>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 14,
                marginBottom: 24,
                textAlign: "center",
                paddingHorizontal: 32,
              }}
            >
              {controller.totalLists === 0
                ? "Create your first list to start organizing gifts for any occasion."
                : "Switch sections or create a new list."}
            </Text>
            <TouchableOpacity
              onPress={controller.openNewList}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.textInverse, fontWeight: "600" }}>
                Create Your First List
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {controller.totalLists > 0 ? (
        <FloatingActionButton onPress={controller.openNewList} accessibilityLabel="Add List" />
      ) : null}
    </GestureHandlerRootView>
  );
}

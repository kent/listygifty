import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GiftItem } from "@/components/GiftItem";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { GiftListSettingsSheet } from "@/components/GiftListSettingsSheet";
import { getGiftStatusColors } from "@/lib/gift-status-colors";
import { useTheme } from "@/lib/theme";
import { useGiftListDetailController } from "@/lib/controllers";

export default function GiftsScreen() {
  const { colors, isDark } = useTheme();
  const controller = useGiftListDetailController();

  if (controller.loading) {
    return <ScreenLoader />;
  }

  const { giftSummary, filteredGiftSummary } = controller;
  const statsLabel = controller.hasActiveFilters
    ? `Showing ${filteredGiftSummary.totalGifts} of ${giftSummary.totalGifts}`
    : `${giftSummary.totalGifts} gift${giftSummary.totalGifts === 1 ? "" : "s"} · ${giftSummary.completionPercent}% done`;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: controller.holiday?.name || "Gifts",
          headerRight: () =>
            controller.holiday ? (
              <TouchableOpacity
                onPress={controller.openSettings}
                style={{ padding: 6, marginRight: 4 }}
                accessibilityRole="button"
                accessibilityLabel="List settings"
              >
                <Ionicons name="settings-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            ) : null,
        }}
      />

      <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
        {controller.holiday ? (
          <TouchableOpacity
            onPress={controller.openSettings}
            accessibilityRole="button"
            accessibilityLabel="View list stats"
            style={{
              backgroundColor: colors.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {statsLabel}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Stats</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            placeholder="Search gifts..."
            placeholderTextColor={colors.placeholder}
            value={controller.search}
            onChangeText={controller.setSearch}
            style={{
              flex: 1,
              backgroundColor: colors.input,
              color: colors.text,
              padding: 12,
              borderRadius: 8,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          />
          <TouchableOpacity
            onPress={controller.toggleFilters}
            style={{
              backgroundColor:
                controller.showFilters || controller.selectedStatusIds.length > 0
                  ? colors.primary
                  : colors.input,
              paddingHorizontal: 14,
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor:
                controller.showFilters || controller.selectedStatusIds.length > 0
                  ? colors.primary
                  : colors.inputBorder,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons
                name="filter"
                size={18}
                color={
                  controller.showFilters || controller.selectedStatusIds.length > 0
                    ? "#fff"
                    : colors.muted
                }
              />
              {controller.selectedStatusIds.length > 0 ? (
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                  {controller.selectedStatusIds.length}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {controller.showFilters ? (
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: "500" }}>
                Filter by Status
              </Text>
              {controller.hasActiveFilters ? (
                <TouchableOpacity onPress={controller.clearFilters}>
                  <Text style={{ color: colors.primary, fontSize: 13 }}>Clear All</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
            >
              <View style={{ flexDirection: "row", gap: 8 }}>
                {controller.statuses.map((status) => {
                  const isSelected = controller.selectedStatusIds.includes(status.id);
                  const statusColor = getGiftStatusColors(status.name, colors, isDark);
                  return (
                    <TouchableOpacity
                      key={status.id}
                      onPress={() => controller.toggleStatusFilter(status.id)}
                      style={{
                        backgroundColor: isSelected
                          ? statusColor.backgroundColor
                          : colors.surfaceSecondary,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: isSelected ? statusColor.textColor : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? statusColor.textColor : colors.muted,
                          fontSize: 13,
                          fontWeight: isSelected ? "600" : "400",
                        }}
                      >
                        {status.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </View>

      {controller.error ? (
        <InlineError message={controller.error} onRetry={controller.retryLoad} margin={16} />
      ) : null}

      <FlatList
        data={controller.filteredGifts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={controller.handleRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const nextStatus = controller.getNextStatusForGift(item);
          return (
            <GiftItem
              item={item}
              nextStatusName={nextStatus?.name}
              onAdvanceStatus={
                nextStatus ? () => controller.handleAdvanceGiftStatus(item.id) : undefined
              }
              onPress={() => controller.handleGiftPress(item.id)}
              onDelete={() => controller.handleDeleteGift(item.id)}
              onOpenLink={() => controller.handleGiftLinkOpen(item, "list_detail_card")}
            />
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              {controller.hasActiveFilters ? "No Matches" : "No Gifts Yet"}
            </Text>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 14,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              {controller.hasActiveFilters
                ? "Try adjusting your filters"
                : "Add your first gift to this list"}
            </Text>
            {controller.hasActiveFilters ? (
              <TouchableOpacity
                onPress={controller.clearFilters}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>Clear Filters</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={controller.triggerAddGift}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: "600" }}>
                  Add Your First Gift
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {controller.filteredGifts.length > 0 || controller.hasActiveFilters ? (
        <FloatingActionButton onPress={controller.triggerAddGift} accessibilityLabel="Add Gift" />
      ) : null}

      {controller.holiday ? (
        <GiftListSettingsSheet
          page={controller.settingsPage}
          holiday={controller.holiday}
          summary={giftSummary}
          schedulingReminder={controller.schedulingReminder}
          shareUrl={controller.shareUrl}
          collaborators={controller.collaborators}
          shareLoading={controller.shareLoading}
          shareError={controller.shareError}
          regenerating={controller.regenerating}
          onClose={controller.closeSettings}
          onBack={controller.openSettings}
          onOpenSharing={controller.openSharing}
          onScheduleReminder={controller.triggerScheduleReminder}
          onRefreshShare={controller.refreshShareData}
          onNativeShare={controller.handleNativeShare}
          onRegenerateLink={controller.triggerRegenerateLink}
          onRemoveCollaborator={controller.removeCollaborator}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

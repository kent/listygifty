import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GiftItem } from "@/components/GiftItem";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { getGiftStatusColors } from "@/lib/gift-status-colors";
import {
  getHolidayCollaboratorInitials,
  getHolidayCollaboratorName,
} from "@/lib/models";
import { useTheme } from "@/lib/theme";
import { useGiftListDetailController } from "@/lib/controllers";

export default function GiftsScreen() {
  const { colors, isDark } = useTheme();
  const controller = useGiftListDetailController();

  if (controller.loading) {
    return <ScreenLoader />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: controller.holiday?.name || "Gifts",
          headerRight: () => (
            <TouchableOpacity
              onPress={controller.openShareModal}
              style={{ marginRight: 4, padding: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Share gift list"
            >
              <Ionicons name="share-social-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
        {controller.holiday ? (
          <TouchableOpacity
            onPress={controller.openShareModal}
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
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                {controller.holiday.collaborator_count} collaborator
                {controller.holiday.collaborator_count === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                {controller.holiday.is_owner ? "Manage sharing" : "Shared list"}
              </Text>
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
        renderItem={({ item }) => (
          <GiftItem
            item={item}
            onPress={() => controller.handleGiftPress(item.id)}
            onDelete={() => controller.handleDeleteGift(item.id)}
          />
        )}
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

      <Modal
        visible={controller.shareModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={controller.closeShareModal}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TouchableOpacity onPress={controller.closeShareModal}>
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>Share List</Text>
            <TouchableOpacity
              onPress={controller.refreshShareData}
              disabled={controller.shareLoading}
              style={{ minWidth: 52, alignItems: "flex-end" }}
            >
              {controller.shareLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>
                  Refresh
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {controller.shareLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {controller.shareError ? (
                <InlineError message={controller.shareError} margin={0} />
              ) : null}

              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  gap: 12,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                  Invite Link
                </Text>
                <Text
                  selectable
                  style={{
                    color: colors.textTertiary,
                    fontSize: 13,
                    backgroundColor: colors.input,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  {controller.shareUrl || "No link available"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={controller.handleNativeShare}
                    disabled={!controller.shareUrl}
                    style={{
                      flex: 1,
                      backgroundColor: controller.shareUrl
                        ? colors.primary
                        : colors.surfaceSecondary,
                      borderRadius: 8,
                      paddingVertical: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: controller.shareUrl ? "#fff" : colors.muted,
                        fontWeight: "600",
                      }}
                    >
                      Share Link
                    </Text>
                  </TouchableOpacity>
                  {controller.holiday?.is_owner ? (
                    <TouchableOpacity
                      onPress={controller.triggerRegenerateLink}
                      disabled={controller.regenerating}
                      style={{
                        backgroundColor: colors.surfaceSecondary,
                        borderRadius: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      {controller.regenerating ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="refresh" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  gap: 10,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                  Collaborators ({controller.collaborators.length})
                </Text>

                {controller.collaborators.length === 0 ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                    No collaborators yet. Share your link to invite people.
                  </Text>
                ) : (
                  controller.collaborators.map((collaborator) => (
                    <View
                      key={collaborator.user_id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: colors.primarySurface,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                            {getHolidayCollaboratorInitials(collaborator)}
                          </Text>
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
                            {getHolidayCollaboratorName(collaborator)}
                          </Text>
                          <Text
                            style={{
                              color: colors.textTertiary,
                              fontSize: 12,
                              textTransform: "capitalize",
                            }}
                          >
                            {collaborator.role}
                          </Text>
                        </View>
                      </View>

                      {controller.holiday?.is_owner && collaborator.role !== "owner" ? (
                        <TouchableOpacity
                          onPress={() => controller.removeCollaborator(collaborator)}
                          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                        >
                          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

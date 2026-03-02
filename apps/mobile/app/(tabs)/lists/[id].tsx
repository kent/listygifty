import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Modal,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useServices } from "@/lib/use-api";
import { useTheme } from "@/lib/theme";
import type { Gift, Holiday, GiftStatus, HolidayCollaborator } from "@niftygifty/types";
import { GiftItem } from "@/components/GiftItem";
import { ScreenLoader } from "@/components/ScreenLoader";
import { InlineError } from "@/components/InlineError";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { getGiftStatusColors } from "@/lib/gift-status-colors";
import {
  getHolidayCollaboratorInitials,
  getHolidayCollaboratorName,
} from "@/lib/holiday-collaborators";

export default function GiftsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { holidays, gifts, giftStatuses } = useServices();
  const { colors, isDark } = useTheme();

  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [allGifts, setAllGifts] = useState<Gift[]>([]);
  const [statuses, setStatuses] = useState<GiftStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<HolidayCollaborator[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedStatusIds, setSelectedStatusIds] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const holidayId = parseInt(id, 10);

  const fetchData = useCallback(async () => {
    if (isNaN(holidayId)) {
      setError("Invalid list ID");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const [holidayData, giftsData, statusesData] = await Promise.all([
        holidays.getById(holidayId),
        gifts.getAll(),
        giftStatuses.getAll(),
      ]);
      setHoliday(holidayData);
      setAllGifts(giftsData);
      setStatuses(statusesData);
    } catch (err) {
      setError("Failed to load gifts");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [holidayId, holidays, gifts, giftStatuses]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Filter gifts for this holiday
  const filteredGifts = useMemo(() => {
    return allGifts
      .filter((gift) => gift.holiday_id === holidayId)
      .filter((gift) => {
        // Search filter
        if (search.trim()) {
          const searchLower = search.toLowerCase();
          const matchesSearch =
            gift.name.toLowerCase().includes(searchLower) ||
            gift.description?.toLowerCase().includes(searchLower) ||
            gift.recipients?.some((r) => r.name.toLowerCase().includes(searchLower));
          if (!matchesSearch) return false;
        }

        // Status filter
        if (selectedStatusIds.length > 0) {
          if (!selectedStatusIds.includes(gift.gift_status_id)) return false;
        }

        return true;
      });
  }, [allGifts, holidayId, search, selectedStatusIds]);

  const handleAddGift = () => {
    router.push({
      pathname: "/(tabs)/lists/gifts/new",
      params: { holiday_id: holidayId.toString() },
    });
  };

  const handleGiftPress = (giftId: number) => {
    router.push({
      pathname: "/(tabs)/lists/gifts/[giftId]",
      params: { giftId: giftId.toString(), holiday_id: holidayId.toString() },
    });
  };

  const handleDeleteGift = async (giftId: number) => {
    try {
      await gifts.delete(giftId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAllGifts((prev) => prev.filter((g) => g.id !== giftId));
    } catch (err) {
      console.error(err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const loadShareData = useCallback(async () => {
    if (!holiday) return;

    setShareLoading(true);
    setShareError(null);
    try {
      const [shareData, collaboratorData] = await Promise.all([
        holidays.getShareLink(holiday.id),
        holidays.getCollaborators(holiday.id),
      ]);
      setShareUrl(shareData.share_url);
      setCollaborators(collaboratorData);
    } catch (err) {
      console.error("Failed to load share data", err);
      setShareError("Could not load sharing details.");
    } finally {
      setShareLoading(false);
    }
  }, [holiday, holidays]);

  const openShareModal = useCallback(async () => {
    setShareModalVisible(true);
    await loadShareData();
  }, [loadShareData]);

  const handleNativeShare = useCallback(async () => {
    if (!shareUrl || !holiday) return;

    try {
      await Share.share({
        message: `Join my "${holiday.name}" gift list: ${shareUrl}`,
        url: shareUrl,
      });
      await Haptics.selectionAsync();
    } catch (err) {
      console.error("Failed to share link", err);
    }
  }, [shareUrl, holiday]);

  const handleRegenerateLink = useCallback(async () => {
    if (!holiday || !holiday.is_owner) return;

    setRegenerating(true);
    setShareError(null);
    try {
      const data = await holidays.regenerateShareLink(holiday.id);
      setShareUrl(data.share_url);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Failed to regenerate link", err);
      setShareError("Could not regenerate share link.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRegenerating(false);
    }
  }, [holiday, holidays]);

  const handleRemoveCollaborator = useCallback(
    (collaborator: HolidayCollaborator) => {
      if (!holiday?.is_owner || collaborator.role === "owner") return;

      Alert.alert(
        "Remove Collaborator",
        `Remove ${getHolidayCollaboratorName(collaborator)} from this gift list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await holidays.removeCollaborator(holiday.id, collaborator.user_id);
                setCollaborators((prev) =>
                  prev.filter((item) => item.user_id !== collaborator.user_id)
                );
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err) {
                console.error("Failed to remove collaborator", err);
                setShareError("Could not remove collaborator.");
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
            },
          },
        ]
      );
    },
    [holiday, holidays]
  );

  const toggleStatusFilter = async (statusId: number) => {
    await Haptics.selectionAsync();
    setSelectedStatusIds((prev) =>
      prev.includes(statusId) ? prev.filter((id) => id !== statusId) : [...prev, statusId]
    );
  };

  const clearFilters = async () => {
    await Haptics.selectionAsync();
    setSelectedStatusIds([]);
    setSearch("");
  };

  const hasActiveFilters = selectedStatusIds.length > 0 || search.trim().length > 0;

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: holiday?.name || "Gifts",
          headerRight: () => (
            <TouchableOpacity
              onPress={openShareModal}
              style={{ marginRight: 4, padding: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Share gift list"
            >
              <Ionicons name="share-social-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Search and Filter Bar */}
      <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
        {holiday ? (
          <TouchableOpacity
            onPress={openShareModal}
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
                {holiday.collaborator_count} collaborator{holiday.collaborator_count === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                {holiday.is_owner ? "Manage sharing" : "Shared list"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            placeholder="Search gifts..."
            placeholderTextColor={colors.placeholder}
            value={search}
            onChangeText={setSearch}
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
            onPress={() => setShowFilters(!showFilters)}
            style={{
              backgroundColor: showFilters || selectedStatusIds.length > 0 ? colors.primary : colors.input,
              paddingHorizontal: 14,
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: showFilters || selectedStatusIds.length > 0 ? colors.primary : colors.inputBorder,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons
                name="filter"
                size={18}
                color={showFilters || selectedStatusIds.length > 0 ? "#fff" : colors.muted}
              />
              {selectedStatusIds.length > 0 ? (
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                  {selectedStatusIds.length}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Status Filters */}
        {showFilters ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: "500" }}>
                Filter by Status
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={{ color: colors.primary, fontSize: 13 }}>Clear All</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {statuses.map((status) => {
                  const isSelected = selectedStatusIds.includes(status.id);
                  const statusColor = getGiftStatusColors(status.name, colors, isDark);
                  return (
                    <TouchableOpacity
                      key={status.id}
                      onPress={() => toggleStatusFilter(status.id)}
                      style={{
                        backgroundColor: isSelected ? statusColor.backgroundColor : colors.surfaceSecondary,
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

      {error ? (
        <InlineError message={error} onRetry={fetchData} margin={16} />
      ) : null}

      <FlatList
        data={filteredGifts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <GiftItem
            item={item}
            onPress={() => handleGiftPress(item.id)}
            onDelete={() => handleDeleteGift(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
              {hasActiveFilters ? "No Matches" : "No Gifts Yet"}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 24, textAlign: "center" }}>
              {hasActiveFilters
                ? "Try adjusting your filters"
                : "Add your first gift to this list"}
            </Text>
            {hasActiveFilters ? (
              <TouchableOpacity
                onPress={clearFilters}
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
                onPress={handleAddGift}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: "600" }}>Add Your First Gift</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* FAB */}
      {filteredGifts.length > 0 || hasActiveFilters ? (
        <FloatingActionButton onPress={handleAddGift} accessibilityLabel="Add Gift" />
      ) : null}

      <Modal
        visible={shareModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShareModalVisible(false)}
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
            <TouchableOpacity onPress={() => setShareModalVisible(false)}>
              <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>Share List</Text>
            <TouchableOpacity
              onPress={loadShareData}
              disabled={shareLoading}
              style={{ minWidth: 52, alignItems: "flex-end" }}
            >
              {shareLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>Refresh</Text>
              )}
            </TouchableOpacity>
          </View>

          {shareLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {shareError ? (
                <InlineError message={shareError} margin={0} />
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
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Invite Link</Text>
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
                  {shareUrl || "No link available"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleNativeShare}
                    disabled={!shareUrl}
                    style={{
                      flex: 1,
                      backgroundColor: shareUrl ? colors.primary : colors.surfaceSecondary,
                      borderRadius: 8,
                      paddingVertical: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: shareUrl ? "#fff" : colors.muted,
                        fontWeight: "600",
                      }}
                    >
                      Share Link
                    </Text>
                  </TouchableOpacity>
                  {holiday?.is_owner ? (
                    <TouchableOpacity
                      onPress={handleRegenerateLink}
                      disabled={regenerating}
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
                      {regenerating ? (
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
                  Collaborators ({collaborators.length})
                </Text>

                {collaborators.length === 0 ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                    No collaborators yet. Share your link to invite people.
                  </Text>
                ) : (
                  collaborators.map((collaborator) => (
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
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
                          <Text style={{ color: colors.textTertiary, fontSize: 12, textTransform: "capitalize" }}>
                            {collaborator.role}
                          </Text>
                        </View>
                      </View>

                      {holiday?.is_owner && collaborator.role !== "owner" ? (
                        <TouchableOpacity
                          onPress={() => handleRemoveCollaborator(collaborator)}
                          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                        >
                          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Remove</Text>
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

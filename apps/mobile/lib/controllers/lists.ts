import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Alert, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { haptics } from "@/lib/haptics";
import { useServices } from "@/lib/use-api";
import { useFocusResource } from "@/lib/controllers/use-focus-resource";
import {
  buildCreateHolidayPayload,
  buildCreateGiftPayload,
  buildGiftFormValues,
  buildUpdateGiftPayload,
  EMPTY_GIFT_FORM_VALUES,
  EMPTY_HOLIDAY_FORM_VALUES,
  filterGifts,
  filterListsBySection,
  getListSectionCounts,
  getResolvedGiftStatusId,
  giftFormHasChanges,
  isValidIsoDate,
  ListSection,
  parseOptionalDecimal,
  type Gift,
  type GiftStatus,
  type Holiday,
  type HolidayCollaborator,
  type GiftFormValues,
  type HolidayFormValues,
} from "@/lib/models";

type GiftListDetailState = {
  holiday: Holiday | null;
  gifts: Gift[];
  statuses: GiftStatus[];
};

export function useGiftListsController() {
  const router = useRouter();
  const { holidays } = useServices();
  const [activeSection, setActiveSection] = useState<ListSection>("active");

  const resource = useFocusResource<Holiday[]>({
    errorMessage: "Failed to load gift lists",
    initialValue: [] as Holiday[],
    load: () => holidays.getAll(),
  });

  const sectionCounts = useMemo(() => getListSectionCounts(resource.data), [resource.data]);
  const filteredLists = useMemo(
    () => filterListsBySection(resource.data, activeSection),
    [resource.data, activeSection]
  );

  const openList = useCallback(
    (listId: number) => {
      router.push(`/(tabs)/lists/${listId}`);
    },
    [router]
  );

  const openNewList = useCallback(() => {
    router.push("/(tabs)/lists/new");
  }, [router]);

  const updateListFlag = useCallback(
    async (item: Holiday, changes: Partial<Pick<Holiday, "completed" | "archived">>) => {
      try {
        await holidays.update(item.id, changes);
        await haptics.success();
        resource.setData((current) =>
          current.map((list) => (list.id === item.id ? { ...list, ...changes } : list))
        );
      } catch (error) {
        console.error("Failed to update list", error);
        await haptics.error();
      }
    },
    [holidays, resource]
  );

  return {
    activeSection,
    error: resource.error,
    filteredLists,
    handleArchive: (item: Holiday) => updateListFlag(item, { archived: !item.archived }),
    handleComplete: (item: Holiday) => updateListFlag(item, { completed: !item.completed }),
    handlePressItem: (item: Holiday) => openList(item.id),
    loading: resource.loading,
    openNewList,
    refreshing: resource.refreshing,
    retryLoad: resource.reload,
    sectionCounts,
    setActiveSection,
    totalLists: resource.data.length,
    triggerRefresh: resource.refresh,
  };
}

export function useGiftListDetailController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { holidays, gifts, giftStatuses } = useServices();
  const holidayId = Number.parseInt(id ?? "", 10);
  const isValidHolidayId = Number.isFinite(holidayId);

  const [search, setSearch] = useState("");
  const [selectedStatusIds, setSelectedStatusIds] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<HolidayCollaborator[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const resource = useFocusResource<GiftListDetailState>({
    enabled: isValidHolidayId,
    errorMessage: "Failed to load gifts",
    initialValue: {
      holiday: null,
      gifts: [],
      statuses: [],
    } satisfies GiftListDetailState,
    key: holidayId,
    load: async () => {
      const [holiday, giftList, statuses] = await Promise.all([
        holidays.getById(holidayId),
        gifts.getAll({ holidayId }),
        giftStatuses.getAll(),
      ]);

      return {
        holiday,
        gifts: giftList,
        statuses,
      };
    },
  });

  const holiday = resource.data.holiday;
  const filteredGifts = useMemo(
    () =>
      filterGifts(resource.data.gifts, {
        search: deferredSearch,
        statusIds: selectedStatusIds,
      }),
    [deferredSearch, resource.data.gifts, selectedStatusIds]
  );

  const hasActiveFilters = selectedStatusIds.length > 0 || search.trim().length > 0;
  const error = !isValidHolidayId ? "Invalid list ID" : resource.error;

  const loadShareData = useCallback(async () => {
    if (!holiday) {
      return;
    }

    setShareLoading(true);
    setShareError(null);

    try {
      const [shareData, collaboratorData] = await Promise.all([
        holidays.getShareLink(holiday.id),
        holidays.getCollaborators(holiday.id),
      ]);
      setShareUrl(shareData.share_url);
      setCollaborators(collaboratorData);
    } catch (shareLoadError) {
      console.error("Failed to load share data", shareLoadError);
      setShareError("Could not load sharing details.");
    } finally {
      setShareLoading(false);
    }
  }, [holiday, holidays]);

  const openAddGift = useCallback(() => {
    if (!isValidHolidayId) {
      return;
    }

    router.push({
      pathname: "/(tabs)/lists/gifts/new",
      params: { holiday_id: holidayId.toString() },
    });
  }, [holidayId, isValidHolidayId, router]);

  const openGift = useCallback(
    (giftId: number) => {
      if (!isValidHolidayId) {
        return;
      }

      router.push({
        pathname: "/(tabs)/lists/gifts/[giftId]",
        params: { giftId: giftId.toString(), holiday_id: holidayId.toString() },
      });
    },
    [holidayId, isValidHolidayId, router]
  );

  const deleteGift = useCallback(
    async (giftId: number) => {
      try {
        await gifts.delete(giftId);
        await haptics.success();
        resource.setData((current) => ({
          ...current,
          gifts: current.gifts.filter((gift) => gift.id !== giftId),
        }));
      } catch (deleteError) {
        console.error("Failed to delete gift", deleteError);
        await haptics.error();
      }
    },
    [gifts, resource]
  );

  const openShareModal = useCallback(() => {
    setShareModalVisible(true);
    void loadShareData();
  }, [loadShareData]);

  const closeShareModal = useCallback(() => {
    setShareModalVisible(false);
  }, []);

  const handleNativeShare = useCallback(async () => {
    if (!shareUrl || !holiday) {
      return;
    }

    try {
      await Share.share({
        message: `Join my "${holiday.name}" gift list: ${shareUrl}`,
        url: shareUrl,
      });
      await haptics.selection();
    } catch (nativeShareError) {
      console.error("Failed to share link", nativeShareError);
    }
  }, [holiday, shareUrl]);

  const handleRegenerateLink = useCallback(async () => {
    if (!holiday?.is_owner) {
      return;
    }

    setRegenerating(true);
    setShareError(null);

    try {
      const data = await holidays.regenerateShareLink(holiday.id);
      setShareUrl(data.share_url);
      await haptics.success();
    } catch (regenerateError) {
      console.error("Failed to regenerate link", regenerateError);
      setShareError("Could not regenerate share link.");
      await haptics.error();
    } finally {
      setRegenerating(false);
    }
  }, [holiday, holidays]);

  const removeCollaborator = useCallback(
    (collaborator: HolidayCollaborator) => {
      if (!holiday?.is_owner || collaborator.role === "owner") {
        return;
      }

      Alert.alert(
        "Remove Collaborator",
        `Remove ${collaborator.email} from this gift list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await holidays.removeCollaborator(holiday.id, collaborator.user_id);
                setCollaborators((current) =>
                  current.filter((item) => item.user_id !== collaborator.user_id)
                );
                await haptics.success();
              } catch (removeError) {
                console.error("Failed to remove collaborator", removeError);
                setShareError("Could not remove collaborator.");
                await haptics.error();
              }
            },
          },
        ]
      );
    },
    [holiday, holidays]
  );

  const toggleStatusFilter = useCallback(async (statusId: number) => {
    await haptics.selection();
    setSelectedStatusIds((current) =>
      current.includes(statusId)
        ? current.filter((idValue) => idValue !== statusId)
        : [...current, statusId]
    );
  }, []);

  const clearFilters = useCallback(async () => {
    await haptics.selection();
    setSelectedStatusIds([]);
    setSearch("");
  }, []);

  return {
    clearFilters,
    closeShareModal,
    collaborators,
    error,
    filteredGifts,
    handleDeleteGift: deleteGift,
    handleGiftPress: openGift,
    handleNativeShare,
    handleRefresh: resource.refresh,
    hasActiveFilters,
    holiday,
    holidayId,
    loading: isValidHolidayId && resource.loading,
    openShareModal,
    refreshShareData: () => {
      void loadShareData();
    },
    refreshing: resource.refreshing,
    regenerating,
    removeCollaborator,
    retryLoad: resource.reload,
    search,
    selectedStatusIds,
    setSearch,
    setShowFilters,
    shareError,
    shareLoading,
    shareModalVisible,
    shareUrl,
    showFilters,
    statuses: resource.data.statuses,
    toggleFilters: () => setShowFilters((current) => !current),
    toggleStatusFilter,
    triggerAddGift: openAddGift,
    triggerRegenerateLink: handleRegenerateLink,
  };
}

export function useNewListController() {
  const router = useRouter();
  const { holidays } = useServices();
  const [form, setForm] = useState<HolidayFormValues>(EMPTY_HOLIDAY_FORM_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback((field: keyof HolidayFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (form.date.trim() && !isValidIsoDate(form.date)) {
      setError("Date must use YYYY-MM-DD");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await holidays.create(
        buildCreateHolidayPayload(form, new Date().toISOString().split("T")[0] || "")
      );
      await haptics.success();
      router.back();
    } catch (submitError) {
      console.error("Failed to create list", submitError);
      setError("Failed to create list");
      await haptics.error();
    } finally {
      setLoading(false);
    }
  }, [form, holidays, router]);

  return {
    error,
    form,
    handleCancel: () => router.back(),
    handleSubmit,
    loading,
    updateField,
  };
}

export function useNewGiftController() {
  const router = useRouter();
  const { holiday_id } = useLocalSearchParams<{ holiday_id: string }>();
  const { gifts, giftStatuses } = useServices();
  const holidayId = holiday_id ? Number.parseInt(holiday_id, 10) : Number.NaN;
  const isValidHolidayId = Number.isFinite(holidayId);

  const [form, setForm] = useState<GiftFormValues>(EMPTY_GIFT_FORM_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusResource = useFocusResource({
    errorMessage: "Failed to load statuses",
    initialValue: [] as GiftStatus[],
    load: () => giftStatuses.getAll(),
  });

  const selectedStatusId = useMemo(
    () => getResolvedGiftStatusId(form, statusResource.data),
    [form, statusResource.data]
  );

  const updateField = useCallback((field: keyof GiftFormValues, value: string | number[]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleStatusChange = useCallback(async (statusId: number) => {
    setForm((current) => ({ ...current, giftStatusId: statusId }));
    await haptics.selection();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!isValidHolidayId) {
      setError("No list selected");
      return;
    }

    if (!selectedStatusId) {
      setError("Please select a status");
      return;
    }

    const parsedCost = parseOptionalDecimal(form.cost);
    if (Number.isNaN(parsedCost)) {
      setError("Cost must be a valid number");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await gifts.create(buildCreateGiftPayload(holidayId, form, selectedStatusId));
      await haptics.success();
      router.back();
    } catch (submitError) {
      console.error("Failed to create gift", submitError);
      setError("Failed to create gift");
      await haptics.error();
    } finally {
      setSaving(false);
    }
  }, [form, gifts, holidayId, isValidHolidayId, router, selectedStatusId]);

  return {
    error,
    form,
    handleCancel: () => router.back(),
    handleStatusChange,
    handleSubmit,
    loadingStatuses: statusResource.loading,
    saving,
    selectedStatusId,
    setGiverIds: (giverIds: number[]) => updateField("giverIds", giverIds),
    setRecipientIds: (recipientIds: number[]) => updateField("recipientIds", recipientIds),
    statuses: statusResource.data,
    statusesError: statusResource.error,
    retryStatuses: statusResource.reload,
    updateField,
  };
}

export function useGiftDetailController() {
  const { giftId } = useLocalSearchParams<{ giftId: string }>();
  const router = useRouter();
  const { gifts, giftStatuses } = useServices();
  const id = Number.parseInt(giftId ?? "", 10);
  const isValidGiftId = Number.isFinite(id);

  const [form, setForm] = useState<GiftFormValues>(EMPTY_GIFT_FORM_VALUES);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const resource = useFocusResource<{
    gift: Gift | null;
    statuses: GiftStatus[];
  }>({
    enabled: isValidGiftId,
    errorMessage: "Failed to load gift",
    initialValue: {
      gift: null as Gift | null,
      statuses: [] as GiftStatus[],
    },
    key: id,
    load: async () => {
      const [gift, statuses] = await Promise.all([gifts.getById(id), giftStatuses.getAll()]);
      setForm(buildGiftFormValues(gift));
      return { gift, statuses };
    },
  });

  const selectedStatusId = useMemo(
    () => getResolvedGiftStatusId(form, resource.data.statuses),
    [form, resource.data.statuses]
  );

  const hasChanges = useMemo(
    () => giftFormHasChanges(resource.data.gift, form),
    [resource.data.gift, form]
  );

  const error = !isValidGiftId ? "Invalid gift ID" : actionError || resource.error;

  const updateField = useCallback((field: keyof GiftFormValues, value: string | number[]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleStatusChange = useCallback(async (statusId: number) => {
    setForm((current) => ({ ...current, giftStatusId: statusId }));
    await haptics.selection();
  }, []);

  const handleSave = useCallback(async () => {
    if (!resource.data.gift) {
      return;
    }

    if (!form.name.trim()) {
      setActionError("Name is required");
      return;
    }

    if (!selectedStatusId) {
      setActionError("Please select a status");
      return;
    }

    const parsedCost = parseOptionalDecimal(form.cost);
    if (Number.isNaN(parsedCost)) {
      setActionError("Cost must be a valid number");
      return;
    }

    setActionError(null);
    setSaving(true);

    try {
      await gifts.update(id, buildUpdateGiftPayload(form, selectedStatusId));
      await haptics.success();
      router.back();
    } catch (saveError) {
      console.error("Failed to save gift", saveError);
      setActionError("Failed to save changes");
      await haptics.error();
    } finally {
      setSaving(false);
    }
  }, [form, gifts, id, resource.data.gift, router, selectedStatusId]);

  const promptDelete = useCallback(() => {
    Alert.alert(
      "Delete Gift",
      `Are you sure you want to delete "${resource.data.gift?.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);

            try {
              await gifts.delete(id);
              await haptics.success();
              router.back();
            } catch (deleteError) {
              console.error("Failed to delete gift", deleteError);
              setActionError("Failed to delete gift");
              await haptics.error();
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [gifts, id, resource.data.gift?.name, router]);

  return {
    deleting,
    error,
    form,
    gift: resource.data.gift,
    handleCancel: () => router.back(),
    handleDelete: promptDelete,
    handleSave,
    handleStatusChange,
    hasChanges,
    loading: isValidGiftId && resource.loading,
    openLink: form.link.trim(),
    saving,
    selectedStatusId,
    setGiverIds: (giverIds: number[]) => updateField("giverIds", giverIds),
    setRecipientIds: (recipientIds: number[]) => updateField("recipientIds", recipientIds),
    statuses: resource.data.statuses,
    retryLoad: resource.reload,
    updateField,
  };
}

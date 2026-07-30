"use client";

import { useState, useCallback, useTransition, useRef, useMemo } from "react";
import { Plus, Loader2, Crown, ListChecks } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortableGiftRow } from "./SortableGiftRow";
import { MobileGiftCard } from "./MobileGiftCard";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useAuth } from "@/contexts/auth-context";
import { giftsService } from "@/services";
import { ApiError } from "@/lib/api-client";
import { captureWebEvent } from "@/lib/analytics";
import { toast } from "sonner";
import type { Gift, Person, GiftStatus, Holiday, CreateGiftRequest, Address } from "@niftygifty/types";

type GiftUpdatePayload = Partial<CreateGiftRequest["gift"]>;
type GiftUpdateOptions = { source?: string };
type LocalGift = Gift & { _isNew?: boolean; _isSaving?: boolean };

interface GiftGridProps {
  gifts: Gift[];           // Filtered gifts for display
  allGifts: Gift[];        // Full unfiltered list for state management
  people: Person[];
  statuses: GiftStatus[];
  holidays: Holiday[];
  addresses: Address[];
  showAddresses: boolean;
  defaultHolidayId?: number;
  defaultStatusId?: number;
  onGiftsChange: (gifts: Gift[]) => void;
  onPeopleChange: (people: Person[]) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function GiftGrid({
  gifts: displayGifts,
  allGifts,
  people,
  statuses,
  holidays,
  addresses,
  showAddresses,
  defaultHolidayId,
  defaultStatusId,
  onGiftsChange,
  onPeopleChange,
  hasActiveFilters = false,
  onClearFilters,
}: GiftGridProps) {
  const [localState, setLocalState] = useState<Record<number, { _isNew?: boolean; _isSaving?: boolean }>>({});
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteGift, setPendingDeleteGift] = useState<Gift | null>(null);
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false);
  const { canCreateGift, giftsRemaining, isPremium, refreshBillingStatus } = useAuth();
  
  const onGiftsChangeRef = useRef(onGiftsChange);
  onGiftsChangeRef.current = onGiftsChange;
  // Use allGifts for state management to preserve unfiltered gifts
  const allGiftsRef = useRef(allGifts);
  allGiftsRef.current = allGifts;

  const getActiveHolidayId = useCallback(
    () => defaultHolidayId || holidays[0]?.id,
    [defaultHolidayId, holidays]
  );

  const refreshGiftList = useCallback(async () => {
    const holidayId = getActiveHolidayId();
    const refreshed = await giftsService.getAll(holidayId ? { holidayId } : undefined);
    return holidayId ? refreshed.filter((gift) => gift.holiday_id === holidayId) : refreshed;
  }, [getActiveHolidayId]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort displayGifts by position for rendering
  const sortedGifts = useMemo(
    () => [...displayGifts].sort((a, b) => a.position - b.position),
    [displayGifts]
  );
  
  const gifts: LocalGift[] = sortedGifts.map((g) => ({
    ...g,
    ...localState[g.id],
  }));

  const giftIds = useMemo(() => gifts.map((g) => g.id), [gifts]);

  const setLocalMeta = (id: number, meta: { _isNew?: boolean; _isSaving?: boolean } | null) => {
    setLocalState((prev) => {
      if (meta === null) {
        const { [id]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      }
      return { ...prev, [id]: { ...prev[id], ...meta } };
    });
  };

  const handlePersonCreated = useCallback((newPerson: Person) => {
    onPeopleChange([...people, newPerson]);
  }, [people, onPeopleChange]);

  const updateGift = useCallback(
    async (id: number, updates: GiftUpdatePayload, options: GiftUpdateOptions = {}) => {
      const currentGift = allGiftsRef.current.find((g) => g.id === id);
      if (!currentGift) return;
      const previousStatusId = currentGift.gift_status_id;
      const nextStatusId = updates.gift_status_id;
      const isStatusChange =
        nextStatusId !== undefined && nextStatusId !== previousStatusId;

      const optimisticGift: Gift = { ...currentGift };
      if (updates.name !== undefined) optimisticGift.name = updates.name;
      if (updates.gift_status_id !== undefined) {
        optimisticGift.gift_status_id = updates.gift_status_id;
        optimisticGift.gift_status = statuses.find((s) => s.id === updates.gift_status_id) || currentGift.gift_status;
      }
      if (updates.cost !== undefined) optimisticGift.cost = updates.cost?.toString() ?? null;

      onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === id ? optimisticGift : g)));

      startTransition(async () => {
        try {
          const updated = await giftsService.update(id, updates);
          setLocalMeta(id, { _isNew: false });
          onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === id ? updated : g)));
          if (isStatusChange) {
            captureWebEvent("gift_status_changed", {
              from_status_id: previousStatusId,
              gift_id: updated.id,
              holiday_id: updated.holiday_id,
              source: options.source || "gift_grid",
              to_status_id: updated.gift_status_id,
            });
          }
        } catch {
          const refreshed = await refreshGiftList();
          onGiftsChangeRef.current(refreshed);
        }
      });
    },
    [statuses, refreshGiftList]
  );

  const updateVisibleStatuses = useCallback(
    async (statusId: number) => {
      const targetStatus = statuses.find((status) => status.id === statusId);
      const targetGifts = gifts.filter((gift) => gift.gift_status_id !== statusId);
      if (!targetStatus || targetGifts.length === 0) {
        toast("Visible gifts already use that status");
        return;
      }

      setIsBulkUpdatingStatus(true);

      const targetGiftIds = new Set(targetGifts.map((gift) => gift.id));
      const optimisticGifts = allGiftsRef.current.map((gift) =>
        targetGiftIds.has(gift.id)
          ? {
              ...gift,
              gift_status_id: statusId,
              gift_status: targetStatus,
            }
          : gift
      );
      onGiftsChangeRef.current(optimisticGifts);

      try {
        const updatedGifts = await Promise.all(
          targetGifts.map((gift) => giftsService.update(gift.id, { gift_status_id: statusId }))
        );
        const updatedById = new Map(updatedGifts.map((gift) => [gift.id, gift]));
        onGiftsChangeRef.current(
          optimisticGifts.map((gift) => updatedById.get(gift.id) || gift)
        );
        captureWebEvent("gift_bulk_status_updated", {
          gift_count: targetGifts.length,
          holiday_id: defaultHolidayId,
          status_id: statusId,
          source: "visible_gifts",
        });
        toast.success(
          `Updated ${targetGifts.length} visible gift${targetGifts.length === 1 ? "" : "s"}`
        );
      } catch {
        const refreshed = await refreshGiftList();
        onGiftsChangeRef.current(refreshed);
        toast.error("Failed to update visible gifts");
      } finally {
        setIsBulkUpdatingStatus(false);
      }
    },
    [defaultHolidayId, gifts, refreshGiftList, statuses]
  );

  const updateRecipients = useCallback(
    async (id: number, recipientIds: number[]) => {
      const currentGift = allGiftsRef.current.find((g) => g.id === id);
      if (!currentGift) return;

      const optimisticGift: Gift = {
        ...currentGift,
        recipients: people.filter((p) => recipientIds.includes(p.id)),
      };
      onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === id ? optimisticGift : g)));

      startTransition(async () => {
        try {
          const updated = await giftsService.update(id, { recipient_ids: recipientIds });
          setLocalMeta(id, { _isNew: false });
          onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === id ? updated : g)));
        } catch {
          const refreshed = await refreshGiftList();
          onGiftsChangeRef.current(refreshed);
        }
      });
    },
    [people, refreshGiftList]
  );

  const updateGivers = useCallback(
    async (id: number, giverIds: number[]) => {
      const currentGift = allGiftsRef.current.find((g) => g.id === id);
      if (!currentGift) return;

      const optimisticGift: Gift = {
        ...currentGift,
        givers: people.filter((p) => giverIds.includes(p.id)),
      };
      onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === id ? optimisticGift : g)));

      startTransition(async () => {
        try {
          const updated = await giftsService.update(id, { giver_ids: giverIds });
          setLocalMeta(id, { _isNew: false });
          onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === id ? updated : g)));
        } catch {
          const refreshed = await refreshGiftList();
          onGiftsChangeRef.current(refreshed);
        }
      });
    },
    [people, refreshGiftList]
  );

  const updateRecipientAddress = useCallback(
    async (giftId: number, recipientId: number, addressId: number | null) => {
      const currentGift = allGiftsRef.current.find((g) => g.id === giftId);
      if (!currentGift) return;

      // Optimistic update
      const optimisticGift: Gift = {
        ...currentGift,
        gift_recipients: currentGift.gift_recipients.map((r) =>
          r.id === recipientId
            ? {
                ...r,
                shipping_address_id: addressId,
                shipping_address: addressId ? addresses.find((a) => a.id === addressId) || null : null,
              }
            : r
        ),
      };
      onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === giftId ? optimisticGift : g)));

      startTransition(async () => {
        try {
          const updated = await giftsService.updateRecipientAddress(giftId, recipientId, addressId);
          onGiftsChangeRef.current(allGiftsRef.current.map((g) => (g.id === giftId ? updated : g)));
        } catch {
          const refreshed = await refreshGiftList();
          onGiftsChangeRef.current(refreshed);
        }
      });
    },
    [addresses, refreshGiftList]
  );

  const addGift = useCallback(async (atPosition?: number) => {
    const holidayId = getActiveHolidayId();
    const statusId = defaultStatusId || statuses[0]?.id;
    if (!holidayId || !statusId) return;
    const shouldClearFilters = hasActiveFilters && Boolean(onClearFilters);

    startTransition(async () => {
      try {
        const desiredPosition = atPosition ?? 0;
        const created = await giftsService.create({
          name: "New Gift",
          holiday_id: holidayId,
          gift_status_id: statusId,
          position: desiredPosition,
        });
        setLocalMeta(created.id, { _isNew: true });
        
        // Always refresh so ordering/positions stay consistent (especially when inserting at top).
        const refreshed = await refreshGiftList();
        onGiftsChangeRef.current(refreshed);
        if (shouldClearFilters) {
          onClearFilters?.();
          toast("Filters cleared so the new gift is visible");
        }

        // Refresh billing status after creating gift
        await refreshBillingStatus();
      } catch (err) {
        if (err instanceof ApiError && err.isGiftLimitReached) {
          toast.error("Gift limit reached", {
            description: "Upgrade to Premium for unlimited gift tracking.",
            action: {
              label: "Upgrade",
              onClick: () => window.location.href = "/billing",
            },
          });
          await refreshBillingStatus();
        } else {
          console.error("Failed to create gift:", err);
          toast.error("Failed to create gift");
        }
      }
    });
  }, [
    defaultStatusId,
    getActiveHolidayId,
    hasActiveFilters,
    onClearFilters,
    refreshBillingStatus,
    refreshGiftList,
    statuses,
  ]);

  const insertGift = useCallback(async (referenceId: number, position: "above" | "below") => {
    const sorted = [...allGiftsRef.current].sort((a, b) => a.position - b.position);
    const refIndex = sorted.findIndex((g) => g.id === referenceId);
    if (refIndex === -1) return;
    
    const refGift = sorted[refIndex];
    const insertPosition = position === "above" ? refGift.position : refGift.position + 1;
    
    await addGift(insertPosition);
  }, [addGift]);

  const deleteGift = useCallback(async (id: number) => {
    setDeletingId(id);
    onGiftsChangeRef.current(allGiftsRef.current.filter((g) => g.id !== id));

    startTransition(async () => {
      try {
        await giftsService.delete(id);
        setLocalMeta(id, null);
        toast.success("Gift deleted");
        // Refresh billing status after deletion
        await refreshBillingStatus();
      } catch {
        const refreshed = await refreshGiftList();
        onGiftsChangeRef.current(refreshed);
      } finally {
        setDeletingId(null);
      }
    });
  }, [refreshBillingStatus, refreshGiftList]);

  const requestDeleteGift = useCallback((gift: Gift) => {
    setPendingDeleteGift(gift);
  }, []);

  const confirmDeleteGift = useCallback(async () => {
    if (!pendingDeleteGift) return;
    const deleteId = pendingDeleteGift.id;
    setPendingDeleteGift(null);
    await deleteGift(deleteId);
  }, [pendingDeleteGift, deleteGift]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sorted = [...allGiftsRef.current].sort((a, b) => a.position - b.position);
    const oldIndex = sorted.findIndex((g) => g.id === active.id);
    const newIndex = sorted.findIndex((g) => g.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate new position based on target
    const targetGift = sorted[newIndex];
    const newPosition = targetGift.position;

    // Optimistic reorder
    const reordered = [...sorted];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    
    // Update positions optimistically
    const optimisticGifts = reordered.map((g, idx) => ({ ...g, position: idx }));
    onGiftsChangeRef.current(optimisticGifts);

    startTransition(async () => {
      try {
        const holidayId = getActiveHolidayId();
        const updatedGifts = await giftsService.reorder(Number(active.id), newPosition);
        onGiftsChangeRef.current(updatedGifts.filter((g) => g.holiday_id === holidayId));
      } catch {
        const refreshed = await refreshGiftList();
        onGiftsChangeRef.current(refreshed);
      }
    });
  }, [getActiveHolidayId, refreshGiftList]);

  const atLimit = !canCreateGift;

  return (
    <div className="w-full space-y-4">
      <UpgradePrompt variant="banner" />
      
      <div className="flex flex-wrap items-center gap-2">
        {atLimit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = "/billing"}
            className="gap-2 border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
          >
            <Crown className="h-4 w-4" />
            Upgrade to Add More
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => addGift()}
            disabled={isPending}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Gift
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={gifts.length === 0 || isBulkUpdatingStatus}
              className="gap-2"
            >
              {isBulkUpdatingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ListChecks className="h-4 w-4" />
              )}
              Set Visible Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {statuses.map((status) => (
              <DropdownMenuItem
                key={status.id}
                onClick={() => {
                  void updateVisibleStatuses(status.id);
                }}
              >
                {status.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {isPending && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
        {!isPremium && giftsRemaining !== null && giftsRemaining > 0 && (
          <span className="text-xs text-muted-foreground">
            {giftsRemaining} free gift{giftsRemaining !== 1 ? "s" : ""} remaining
          </span>
        )}
      </div>

      {/* Desktop table view */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden md:block rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[180px] font-semibold">To</TableHead>
                {showAddresses && (
                  <TableHead className="w-[100px] font-semibold">Ship To</TableHead>
                )}
                <TableHead className="w-[180px] font-semibold">From</TableHead>
                <TableHead className="min-w-[250px] font-semibold">Item</TableHead>
                <TableHead className="w-[140px] font-semibold">Status</TableHead>
                <TableHead className="w-[100px] text-right font-semibold">Cost</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext items={giftIds} strategy={verticalListSortingStrategy}>
                {gifts.map((gift) => (
                  <SortableGiftRow
                    key={gift.id}
                    gift={gift}
                    people={people}
                    statuses={statuses}
                    addresses={addresses}
                    showAddresses={showAddresses}
                    deletingId={deletingId}
                    onUpdateGift={updateGift}
                    onUpdateRecipients={updateRecipients}
                    onUpdateGivers={updateGivers}
                    onUpdateRecipientAddress={updateRecipientAddress}
                    onInsertGift={insertGift}
                    onRequestDelete={requestDeleteGift}
                    onPersonCreated={handlePersonCreated}
                  />
                ))}
              </SortableContext>
              {gifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showAddresses ? 8 : 7} className="h-24 text-center text-muted-foreground">
                    No gifts yet. Click the button above to add one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DndContext>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3 pb-20">
        {gifts.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-400">No gifts yet. Tap + to add one.</p>
          </div>
        ) : (
          gifts.map((gift) => (
            <MobileGiftCard
              key={gift.id}
              gift={gift}
              people={people}
              statuses={statuses}
              isDeleting={deletingId === gift.id}
              onUpdateGift={updateGift}
              onUpdateRecipients={updateRecipients}
              onUpdateGivers={updateGivers}
              onRequestDelete={requestDeleteGift}
              onPersonCreated={handlePersonCreated}
            />
          ))
        )}
      </div>

      {/* Mobile FAB for quick add */}
      {!atLimit && (
        <button
          onClick={() => addGift()}
          disabled={isPending}
          className="md:hidden fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 hover:from-violet-600 hover:to-fuchsia-600 active:scale-95 transition-all disabled:opacity-50"
          aria-label="Add gift"
        >
          {isPending ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </button>
      )}

      <AlertDialog
        open={pendingDeleteGift !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteGift(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete gift?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteGift?.name
                ? `This will permanently remove "${pendingDeleteGift.name}" from this gift list.`
                : "This will permanently remove this gift from the list."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGift}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
            >
              Delete Gift
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

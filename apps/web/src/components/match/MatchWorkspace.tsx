"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { matchArrangementsService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Users, Gift as GiftIcon, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { Gift, Person, MatchArrangement, MatchSlot, MatchGrouping, GiftStatus } from "@niftygifty/types";
import { DraggableGift } from "./DraggableGift";
import { DroppableSlot } from "./DroppableSlot";
import { GroupManageModal } from "./GroupManageModal";
import { SharedGiftEditDialog } from "./SharedGiftEditDialog";
import { AddGiftForPersonDialog } from "./AddGiftForPersonDialog";

const MAX_PEOPLE = 4;
const MAX_ROWS = 10;

export type MatchDisplayItem = {
  id: string; // dnd id (gift-<id> or group-<id>)
  kind: "gift" | "group";
  personId: number;
  name: string;
  cost: number;
  giftIds: number[];
  groupId?: string;
};

interface MatchWorkspaceProps {
  holidayId: number;
  gifts: Gift[];
  people: Person[];
  statuses: GiftStatus[];
  arrangement: MatchArrangement | null;
  onArrangementChange: (arrangement: MatchArrangement) => void;
  onGiftsChange?: (gifts: Gift[]) => void;
  onPeopleChange?: (people: Person[]) => void;
}

export function MatchWorkspace({
  holidayId,
  gifts,
  people,
  statuses,
  arrangement,
  onArrangementChange,
  onGiftsChange,
  onPeopleChange,
}: MatchWorkspaceProps) {
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>(
    arrangement?.person_ids || []
  );
  const [slots, setSlots] = useState<MatchSlot[]>(arrangement?.slots || []);
  const [groupings, setGroupings] = useState<MatchGrouping[]>(arrangement?.groupings || []);
  const [activeItem, setActiveItem] = useState<MatchDisplayItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowCount, setRowCount] = useState(() => {
    if (!arrangement?.slots?.length) return 3;
    const maxRow = Math.max(...arrangement.slots.map(s => s.row_index));
    return Math.max(3, maxRow + 2);
  });
  const [manageGroupItem, setManageGroupItem] = useState<MatchDisplayItem | null>(null);
  const [editingSharedGift, setEditingSharedGift] = useState<Gift | null>(null);
  const [addGiftForPerson, setAddGiftForPerson] = useState<Person | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection that prioritizes combine targets over slots
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check pointerWithin for precise detection
    const pointerCollisions = pointerWithin(args);
    
    // If we have a combine target in the collisions, prioritize it
    const combineCollision = pointerCollisions.find(c => String(c.id).startsWith("combine-"));
    if (combineCollision) {
      return [combineCollision];
    }
    
    // Fall back to rectIntersection for slots
    const rectCollisions = rectIntersection(args);
    return rectCollisions.length > 0 ? rectCollisions : pointerCollisions;
  }, []);

  const selectedPeople = useMemo(
    () => people.filter(p => selectedPersonIds.includes(p.id)),
    [people, selectedPersonIds]
  );

  // Identify gifts shared between multiple selected people
  const { sharedGifts, giftsByPerson } = useMemo(() => {
    const selectedSet = new Set(selectedPersonIds);
    const shared: Gift[] = [];
    const map = new Map<number, Gift[]>();
    selectedPersonIds.forEach(pid => map.set(pid, []));

    gifts.forEach(g => {
      const recipientIds = g.recipients.map(r => r.id);
      const selectedRecipients = recipientIds.filter(id => selectedSet.has(id));
      if (selectedRecipients.length >= 2) {
        // Shared gift - goes to shared section
        shared.push(g);
      } else if (selectedRecipients.length === 1) {
        // Single recipient - goes to that person's column
        const list = map.get(selectedRecipients[0]);
        if (list) list.push(g);
      }
    });

    return { sharedGifts: shared, giftsByPerson: map };
  }, [gifts, selectedPersonIds]);

  const groupingsById = useMemo(() => {
    const map = new Map<string, MatchGrouping>();
    groupings.forEach(g => map.set(g.id, g));
    return map;
  }, [groupings]);

  const displayItemsByPerson = useMemo(() => {
    const map = new Map<number, MatchDisplayItem[]>();

    selectedPersonIds.forEach(pid => {
      const items: MatchDisplayItem[] = [];
      const groupedGiftIds = new Set<number>();

      groupings
        .filter(g => g.person_id === pid)
        .forEach(g => {
          g.gift_ids.forEach(id => groupedGiftIds.add(id));
          const giftsForGroup = (g.gift_ids || []).map(id => gifts.find(gift => gift.id === id)).filter(Boolean) as Gift[];
          const cost = giftsForGroup.reduce((sum, gift) => sum + (gift?.cost ? parseFloat(gift.cost) : 0), 0);
          items.push({
            id: `group-${g.id}`,
            groupId: g.id,
            kind: "group",
            personId: pid,
            name: g.label || giftsForGroup.map(gift => gift.name).join(" + "),
            cost,
            giftIds: g.gift_ids,
          });
        });

      const personGifts = giftsByPerson.get(pid) || [];
      personGifts
        .filter(gift => !groupedGiftIds.has(gift.id))
        .forEach(gift => {
          items.push({
            id: `gift-${gift.id}`,
            kind: "gift",
            personId: pid,
            name: gift.name,
            cost: gift.cost ? parseFloat(gift.cost) : 0,
            giftIds: [gift.id],
          });
        });

      map.set(pid, items);
    });

    return map;
  }, [groupings, gifts, giftsByPerson, selectedPersonIds]);

  // Shared gifts with their recipient names for display
  const sharedGiftsWithRecipients = useMemo(() => {
    return sharedGifts.map(gift => ({
      gift,
      recipients: gift.recipients
        .filter(r => selectedPersonIds.includes(r.id))
        .map(r => r.name),
    }));
  }, [sharedGifts, selectedPersonIds]);

  const displayItemMap = useMemo(() => {
    const map = new Map<string, MatchDisplayItem>();
    displayItemsByPerson.forEach(items => {
      items.forEach(item => map.set(item.id, item));
    });
    return map;
  }, [displayItemsByPerson]);

  const placedItemIds = useMemo(() => {
    const set = new Set<string>();
    // Only consider slots for currently selected people
    slots
      .filter(s => selectedPersonIds.includes(s.person_id))
      .forEach(s => {
        if (s.gift_id) set.add(`gift-${s.gift_id}`);
        if (s.group_key) set.add(`group-${s.group_key}`);
      });
    return set;
  }, [slots, selectedPersonIds]);

  const unplacedItemsByPerson = useMemo(() => {
    const map = new Map<number, MatchDisplayItem[]>();
    selectedPersonIds.forEach(pid => {
      const items = displayItemsByPerson.get(pid) || [];
      map.set(pid, items.filter(item => !placedItemIds.has(item.id)));
    });
    return map;
  }, [displayItemsByPerson, placedItemIds, selectedPersonIds]);

  const handleAddPerson = useCallback((personId: string) => {
    const id = Number(personId);
    if (selectedPersonIds.length >= MAX_PEOPLE) {
      toast.error(`Maximum ${MAX_PEOPLE} people allowed`);
      return;
    }
    if (!selectedPersonIds.includes(id)) {
      setSelectedPersonIds(prev => [...prev, id]);
    }
  }, [selectedPersonIds]);

  const handleRemovePerson = useCallback((personId: number) => {
    setSelectedPersonIds(prev => prev.filter(id => id !== personId));
    setSlots(prev => prev.filter(s => s.person_id !== personId));
    setGroupings(prev => prev.filter(g => g.person_id !== personId));
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const item = displayItemMap.get(id);
    setActiveItem(item || null);
  }, [displayItemMap]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const item = displayItemMap.get(activeId);
    if (!item) return;

    // Grouping via drag onto another gift/group
    if (overId.startsWith("combine-")) {
      const match = overId.match(/^combine-(\d+)-(.+)$/);
      if (!match) return;
      const targetPersonId = Number(match[1]);
      const targetKey = match[2];
      if (targetPersonId !== item.personId) {
        toast.error("Can only combine gifts for the same person");
        return;
      }

      const targetId = targetKey;
      const targetItem = displayItemMap.get(targetId);
      if (!targetItem) return;
      if (targetItem.id === activeId) return;

      // Check if either item is in a slot (combining in slot)
      const activeInSlot = placedItemIds.has(activeId);
      const targetInSlot = placedItemIds.has(targetItem.id);
      const combiningInSlot = targetInSlot;

      // If active item is in a slot, don't allow (must drag unplaced onto placed)
      if (activeInSlot) {
        toast.error("Remove the gift from its slot before combining");
        return;
      }

      // Find the slot where target is placed (if any)
      const targetSlot = combiningInSlot
        ? slots.find(s =>
            (targetItem.kind === "gift" && s.gift_id === targetItem.giftIds[0]) ||
            (targetItem.kind === "group" && s.group_key === targetItem.groupId)
          )
        : null;

      // Compute new groupings synchronously (React setState doesn't run callback immediately)
      let newGroupId: string;
      let updatedGroupings: MatchGrouping[];

      if (targetItem.kind === "group" && targetItem.groupId) {
        // Add into existing group
        newGroupId = targetItem.groupId;
        updatedGroupings = groupings.map(g =>
          g.id === targetItem.groupId && !g.gift_ids.includes(item.giftIds[0])
            ? { ...g, gift_ids: [...g.gift_ids, ...item.giftIds] }
            : g
        );
      } else {
        // Create a new group
        newGroupId = crypto.randomUUID?.() ?? `grp-${Date.now()}`;
        const newGroup: MatchGrouping = {
          id: newGroupId,
          label: `${targetItem.name} + ${item.name}`,
          person_id: targetPersonId,
          gift_ids: [...targetItem.giftIds, ...item.giftIds],
        };
        updatedGroupings = [...groupings, newGroup];
      }

      // Ensure gifts are only in one group per person and drop empty groups
      updatedGroupings = updatedGroupings
        .map(g => {
          if (g.person_id !== targetPersonId) return g;
          if (g.id === newGroupId) return g;
          const filteredIds = g.gift_ids.filter(id => !item.giftIds.includes(id));
          return { ...g, gift_ids: filteredIds };
        })
        .filter(g => g.gift_ids.length > 0);

      setGroupings(updatedGroupings);

      // If combining in a slot, update the slot to reference the new group
      let updatedSlots = slots;
      if (combiningInSlot && targetSlot) {
        updatedSlots = slots.map(s => {
          if (s.person_id === targetSlot.person_id && s.row_index === targetSlot.row_index) {
            return { ...s, gift_id: null, group_key: newGroupId };
          }
          return s;
        });
        setSlots(updatedSlots);
      }

      // Auto-save grouping change when arrangement exists
      if (arrangement?.id && selectedPersonIds.length >= 2) {
        try {
          const slotsData = updatedSlots.map(s => ({
            id: s.id || undefined,
            person_id: s.person_id,
            gift_id: s.gift_id,
            group_key: s.group_key,
            row_index: s.row_index,
          }));
          const result = await matchArrangementsService.update(arrangement.id, {
            person_ids: selectedPersonIds,
            groupings: updatedGroupings,
            slots: slotsData,
          });
          onArrangementChange(result);
          setGroupings(result.groupings || []);
          setSlots(result.slots);
        } catch {
          toast.error("Failed to save grouping");
        }
      }
      return;
    }

    // Dropping into a slot
    const [personId, rowIndex] = overId.split("-").map(Number);

    // Find where the dragged item currently is (if placed)
    const sourceSlot = slots.find(s =>
      (item.kind === "gift" && s.gift_id === item.giftIds[0]) ||
      (item.kind === "group" && s.group_key === item.groupId)
    );

    // Find what's in the target slot (if anything)
    const targetSlot = slots.find(s => s.person_id === personId && s.row_index === rowIndex);

    // Compute new slots with swap support
    const computeNewSlots = (): MatchSlot[] => {
      let result = [...slots];

      // If swapping (both source and target exist), swap their contents
      if (sourceSlot && targetSlot) {
        result = result.map(s => {
          // Update source slot to have target's content
          if (s.person_id === sourceSlot.person_id && s.row_index === sourceSlot.row_index) {
            return { ...s, gift_id: targetSlot.gift_id, group_key: targetSlot.group_key };
          }
          // Update target slot to have source's content
          if (s.person_id === targetSlot.person_id && s.row_index === targetSlot.row_index) {
            return {
              ...s,
              gift_id: item.kind === "gift" ? item.giftIds[0] : null,
              group_key: item.kind === "group" ? item.groupId || null : null,
            };
          }
          return s;
        });
      }
      // If just moving (source exists, target empty)
      else if (sourceSlot && !targetSlot) {
        // Remove from old position
        result = result.filter(s =>
          !(s.person_id === sourceSlot.person_id && s.row_index === sourceSlot.row_index)
        );
        // Add to new position
        result.push({
          id: 0,
          match_arrangement_id: arrangement?.id || 0,
          person_id: personId,
          gift_id: item.kind === "gift" ? item.giftIds[0] : null,
          group_key: item.kind === "group" ? item.groupId || null : null,
          row_index: rowIndex,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as MatchSlot);
      }
      // If dropping from pool into slot
      else {
        // Remove item if it was in another slot
        result = result.filter(s => {
          const isSameGift = item.kind === "gift" && s.gift_id === item.giftIds[0];
          const isSameGroup = item.kind === "group" && s.group_key === item.groupId;
          return !isSameGift && !isSameGroup;
        });

        // Check if target slot has something
        const existingIdx = result.findIndex(
          s => s.person_id === personId && s.row_index === rowIndex
        );

        const newSlot = {
          id: 0,
          match_arrangement_id: arrangement?.id || 0,
          person_id: personId,
          gift_id: item.kind === "gift" ? item.giftIds[0] : null,
          group_key: item.kind === "group" ? item.groupId || null : null,
          row_index: rowIndex,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as MatchSlot;

        if (existingIdx >= 0) {
          result[existingIdx] = { ...result[existingIdx], ...newSlot };
        } else {
          result.push(newSlot);
        }
      }

      return result;
    };

    // Get current slots and compute new state
    const newSlots = computeNewSlots();
    setSlots(newSlots);

    // Auto-save after drop
    if (selectedPersonIds.length >= 2) {
      try {
        const slotsData = newSlots.map(s => ({
          id: s.id || undefined,
          person_id: s.person_id,
          gift_id: s.gift_id,
          group_key: s.group_key,
          row_index: s.row_index,
        }));

        let result: MatchArrangement;
        if (arrangement?.id) {
          result = await matchArrangementsService.update(arrangement.id, {
            slots: slotsData,
            groupings,
          });
        } else {
          result = await matchArrangementsService.create({
            holiday_id: holidayId,
            person_ids: selectedPersonIds,
          });
          result = await matchArrangementsService.update(result.id, {
            slots: slotsData,
            groupings,
          });
        }
        onArrangementChange(result);
        setSlots(result.slots);
        setGroupings(result.groupings || []);
      } catch {
        toast.error("Failed to save");
      }
    }
  }, [arrangement?.id, displayItemMap, groupings, holidayId, onArrangementChange, placedItemIds, selectedPersonIds, slots]);

  const handleRemoveFromSlot = useCallback(async (personId: number, rowIndex: number) => {
    let newSlots: MatchSlot[];
    setSlots(prev => {
      newSlots = prev.filter(s => !(s.person_id === personId && s.row_index === rowIndex));
      return newSlots;
    });

    // Auto-save after remove
    if (arrangement?.id) {
      try {
        const slotsData = newSlots!.map(s => ({
          id: s.id || undefined,
          person_id: s.person_id,
          gift_id: s.gift_id,
          group_key: s.group_key,
          row_index: s.row_index,
        }));
        const result = await matchArrangementsService.update(arrangement.id, {
          slots: slotsData,
          groupings,
        });
        onArrangementChange(result);
        setSlots(result.slots);
        setGroupings(result.groupings || []);
      } catch {
        toast.error("Failed to save");
      }
    }
  }, [arrangement?.id, groupings, onArrangementChange]);

  const handleAddRow = useCallback(() => {
    if (rowCount < MAX_ROWS) {
      setRowCount(prev => prev + 1);
    }
  }, [rowCount]);

  const handleRenameGroup = useCallback(
    async (groupId: string) => {
      const group = groupings.find(g => g.id === groupId);
      if (!group) return;
      const nextLabel = window.prompt("Group label", group.label);
      if (!nextLabel || !nextLabel.trim() || nextLabel === group.label) return;

      const updated = groupings.map(g => (g.id === groupId ? { ...g, label: nextLabel.trim() } : g));
      setGroupings(updated);

      if (arrangement?.id) {
        try {
          const result = await matchArrangementsService.update(arrangement.id, {
            groupings: updated,
            slots: slots.map(s => ({
              id: s.id || undefined,
              person_id: s.person_id,
              gift_id: s.gift_id,
              group_key: s.group_key,
              row_index: s.row_index,
            })),
            person_ids: selectedPersonIds,
          });
          onArrangementChange(result);
          setGroupings(result.groupings || []);
          setSlots(result.slots);
        } catch {
          toast.error("Failed to rename group");
        }
      }
    },
    [arrangement?.id, groupings, onArrangementChange, selectedPersonIds, slots]
  );

  const handleRemoveGroup = useCallback(
    async (groupId: string) => {
      const updatedGroupings = groupings.filter(g => g.id !== groupId);
      let updatedSlots: MatchSlot[] = [];
      setSlots(prev => {
        updatedSlots = prev.filter(s => s.group_key !== groupId);
        return updatedSlots;
      });
      setGroupings(updatedGroupings);

      if (arrangement?.id) {
        try {
          const result = await matchArrangementsService.update(arrangement.id, {
            groupings: updatedGroupings,
            slots: updatedSlots.map(s => ({
              id: s.id || undefined,
              person_id: s.person_id,
              gift_id: s.gift_id,
              group_key: s.group_key,
              row_index: s.row_index,
            })),
            person_ids: selectedPersonIds,
          });
          onArrangementChange(result);
          setGroupings(result.groupings || []);
          setSlots(result.slots);
        } catch {
          toast.error("Failed to remove group");
        }
      }
    },
    [arrangement?.id, groupings, onArrangementChange, selectedPersonIds]
  );

  const handleRemoveGiftFromGroup = useCallback(
    async (groupId: string, giftId: number) => {
      const group = groupings.find(g => g.id === groupId);
      if (!group) return;

      let updatedGroupings: MatchGrouping[];
      let updatedSlots = slots;

      if (group.gift_ids.length <= 2) {
        // Dissolve group - remove it entirely
        updatedGroupings = groupings.filter(g => g.id !== groupId);
        // If the group was in a slot, remove it
        updatedSlots = slots.filter(s => s.group_key !== groupId);
      } else {
        // Just remove the one gift from the group
        updatedGroupings = groupings.map(g =>
          g.id === groupId
            ? { ...g, gift_ids: g.gift_ids.filter(id => id !== giftId) }
            : g
        );
      }

      setGroupings(updatedGroupings);
      setSlots(updatedSlots);

      // Update the modal's item reference if still open
      if (manageGroupItem?.groupId === groupId) {
        if (group.gift_ids.length <= 2) {
          setManageGroupItem(null);
        } else {
          const updatedGroup = updatedGroupings.find(g => g.id === groupId);
          if (updatedGroup) {
            const giftsForGroup = updatedGroup.gift_ids
              .map(id => gifts.find(g => g.id === id))
              .filter(Boolean) as Gift[];
            const cost = giftsForGroup.reduce((sum, g) => sum + (g.cost ? parseFloat(g.cost) : 0), 0);
            setManageGroupItem({
              ...manageGroupItem,
              giftIds: updatedGroup.gift_ids,
              cost,
              name: updatedGroup.label || giftsForGroup.map(g => g.name).join(" + "),
            });
          }
        }
      }

      if (arrangement?.id) {
        try {
          const result = await matchArrangementsService.update(arrangement.id, {
            groupings: updatedGroupings,
            slots: updatedSlots.map(s => ({
              id: s.id || undefined,
              person_id: s.person_id,
              gift_id: s.gift_id,
              group_key: s.group_key,
              row_index: s.row_index,
            })),
            person_ids: selectedPersonIds,
          });
          onArrangementChange(result);
          setGroupings(result.groupings || []);
          setSlots(result.slots);
        } catch {
          toast.error("Failed to update group");
        }
      }
    },
    [arrangement?.id, gifts, groupings, manageGroupItem, onArrangementChange, selectedPersonIds, slots]
  );

  const handleSave = useCallback(async () => {
    if (selectedPersonIds.length < 2) {
      toast.error("Select at least 2 people to compare");
      return;
    }

    setSaving(true);
    try {
      const slotsData = slots.map(s => ({
        id: s.id || undefined,
        person_id: s.person_id,
        gift_id: s.gift_id,
        group_key: s.group_key,
        row_index: s.row_index,
      }));

      let result: MatchArrangement;
      if (arrangement?.id) {
        result = await matchArrangementsService.update(arrangement.id, {
          person_ids: selectedPersonIds,
          slots: slotsData,
          groupings,
        });
      } else {
        result = await matchArrangementsService.create({
          holiday_id: holidayId,
          person_ids: selectedPersonIds,
        });
        if (slotsData.length > 0) {
          result = await matchArrangementsService.update(result.id, {
            slots: slotsData,
            groupings,
          });
        }
      }
      onArrangementChange(result);
      setSlots(result.slots);
      setGroupings(result.groupings || []);
      toast.success("Arrangement saved!");
    } catch {
      toast.error("Failed to save arrangement");
    } finally {
      setSaving(false);
    }
  }, [arrangement?.id, groupings, holidayId, onArrangementChange, selectedPersonIds, slots]);

  const availablePeopleToAdd = people.filter(p => !selectedPersonIds.includes(p.id));

  const handleSharedGiftUpdated = useCallback((updatedGift: Gift) => {
    onGiftsChange?.(gifts.map(g => g.id === updatedGift.id ? updatedGift : g));
  }, [gifts, onGiftsChange]);

  const handleGiftCreated = useCallback((newGift: Gift) => {
    // New gifts should appear at the top.
    onGiftsChange?.([newGift, ...gifts.filter((g) => g.id !== newGift.id)]);
  }, [gifts, onGiftsChange]);

  const handlePersonCreated = useCallback((newPerson: Person) => {
    onPeopleChange?.([...people, newPerson]);
  }, [people, onPeopleChange]);

  // Calculate totals per person
  const totals = useMemo(() => {
    const map = new Map<number, { count: number; value: number }>();
    selectedPersonIds.forEach(pid => {
      const personSlots = slots.filter(
        s => s.person_id === pid && (s.gift_id || s.group_key)
      );
      let value = 0;
      personSlots.forEach(s => {
        if (s.gift_id) {
          const gift = gifts.find(g => g.id === s.gift_id);
          if (gift?.cost) value += parseFloat(gift.cost);
        } else if (s.group_key) {
          const grouping = groupingsById.get(s.group_key);
          const giftsForGroup = grouping
            ? grouping.gift_ids
                .map(id => gifts.find(g => g.id === id))
                .filter(Boolean) as Gift[]
            : [];
          giftsForGroup.forEach(gift => {
            if (gift.cost) value += parseFloat(gift.cost);
          });
        }
      });
      map.set(pid, { count: personSlots.length, value });
    });
    return map;
  }, [slots, selectedPersonIds, gifts, groupingsById]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* People Selector */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-violet-400" />
              Select People to Compare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-center">
              {selectedPeople.map(person => (
                <div
                  key={person.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30"
                >
                  <span className="text-white font-medium">{person.name}</span>
                  <button
                    onClick={() => handleRemovePerson(person.id)}
                    className="text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {selectedPersonIds.length < MAX_PEOPLE && availablePeopleToAdd.length > 0 && (
                <Select onValueChange={handleAddPerson}>
                  <SelectTrigger className="w-[180px] border-dashed border-slate-600">
                    <SelectValue placeholder="Add person..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeopleToAdd.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-2">
              {selectedPersonIds.length}/{MAX_PEOPLE} people selected
            </p>

            {/* Quick Stats */}
            {selectedPersonIds.length >= 2 && (
              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {selectedPeople.map(person => {
                  const count = (giftsByPerson.get(person.id) || []).length;
                  return (
                    <span key={person.id} className="text-slate-400">
                      <span className="text-white font-medium">{person.name}:</span>{" "}
                      {count} gift{count !== 1 ? "s" : ""}
                    </span>
                  );
                })}
                {sharedGifts.length > 0 && (
                  <a
                    href="#shared-gifts"
                    className="text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {sharedGifts.length} shared gift{sharedGifts.length !== 1 ? "s" : ""} ↓
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPersonIds.length >= 2 && (
          <>
            {/* Matching Grid */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedPersonIds.length}, minmax(200px, 1fr))` }}>
              {selectedPeople.map(person => {
                const personTotal = totals.get(person.id);
                return (
                  <Card key={person.id} className="border-slate-800 bg-slate-900/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-white flex items-center justify-between">
                        <span>{person.name}</span>
                        {personTotal && (
                          <span className="text-sm font-normal text-slate-400">
                            {personTotal.count} gifts • ${personTotal.value.toFixed(0)}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {/* Slots */}
                      {Array.from({ length: rowCount }).map((_, rowIndex) => {
                        const slot = slots.find(
                          s => s.person_id === person.id && s.row_index === rowIndex
                        );
                        const item =
                          slot?.group_key
                            ? displayItemMap.get(`group-${slot.group_key}`) ||
                              (() => {
                                const grouping = groupingsById.get(slot.group_key!);
                                if (!grouping) return null;
                                const giftsForGroup = grouping.gift_ids
                                  .map(id => gifts.find(g => g.id === id))
                                  .filter(Boolean) as Gift[];
                                const cost = giftsForGroup.reduce(
                                  (sum, gift) => sum + (gift.cost ? parseFloat(gift.cost) : 0),
                                  0
                                );
                                return {
                                  id: `group-${grouping.id}`,
                                  kind: "group" as const,
                                  personId: person.id,
                                  name: grouping.label || giftsForGroup.map(g => g.name).join(" + "),
                                  cost,
                                  giftIds: grouping.gift_ids,
                                  groupId: grouping.id,
                                } as MatchDisplayItem;
                              })()
                            : slot?.gift_id
                              ? displayItemMap.get(`gift-${slot.gift_id}`) ||
                                (() => {
                                  const gift = gifts.find(g => g.id === slot.gift_id);
                                  return gift
                                    ? {
                                        id: `gift-${gift.id}`,
                                        kind: "gift" as const,
                                        personId: person.id,
                                        name: gift.name,
                                        cost: gift.cost ? parseFloat(gift.cost) : 0,
                                        giftIds: [gift.id],
                                      }
                                    : null;
                                })()
                              : null;
                        return (
                          <DroppableSlot
                            key={`${person.id}-${rowIndex}`}
                            id={`${person.id}-${rowIndex}`}
                            item={item || null}
                            rowIndex={rowIndex}
                            onRemove={() => handleRemoveFromSlot(person.id, rowIndex)}
                            onManageGroup={setManageGroupItem}
                          />
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-white hover:border-slate-500"
                        onClick={handleAddRow}
                        disabled={rowCount >= MAX_ROWS}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Row
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Unplaced Gifts Pool */}
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GiftIcon className="h-5 w-5 text-fuchsia-400" />
                  Available Gifts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedPersonIds.length}, minmax(200px, 1fr))` }}>
                  {selectedPeople.map(person => {
                    const unplaced = unplacedItemsByPerson.get(person.id) || [];
                    return (
                      <div key={person.id} className="space-y-2">
                        <h4 className="text-sm font-medium text-slate-400 mb-2">{person.name}&apos;s Gifts</h4>
                        {unplaced.length === 0 ? (
                          <p className="text-sm text-slate-600 italic">All gifts placed</p>
                        ) : (
                          <div className="space-y-2">
                            {unplaced.map(item => {
                              const gift = item.kind === "gift" ? gifts.find(g => g.id === item.giftIds[0]) : null;
                              return (
                                <DraggableGift
                                  key={item.id}
                                  item={item}
                                  combineTargetId={`combine-${person.id}-${item.id}`}
                                  onRenameGroup={handleRenameGroup}
                                  onRemoveGroup={handleRemoveGroup}
                                  onEdit={gift ? () => setEditingSharedGift(gift) : undefined}
                                />
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={() => setAddGiftForPerson(person)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-violet-400 hover:bg-slate-800/50 rounded-lg transition-colors"
                        >
                          + Add Gift for {person.name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Shared Gifts Section */}
            {sharedGiftsWithRecipients.length > 0 && (
              <Card id="shared-gifts" className="border-slate-800 bg-slate-900/50 border-dashed border-amber-500/30 scroll-mt-4">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-amber-400" />
                    Shared Gifts
                    <span className="text-sm font-normal text-slate-500">
                      (for multiple people)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sharedGiftsWithRecipients.map(({ gift, recipients }) => (
                      <button
                        key={gift.id}
                        onClick={() => setEditingSharedGift(gift)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <GiftIcon className="h-4 w-4 text-amber-400" />
                          <span className="font-medium text-white">{gift.name}</span>
                          <span className="text-sm text-slate-400">
                            → {recipients.join(" & ")}
                          </span>
                        </div>
                        <span className="text-amber-300">
                          ${gift.cost ? parseFloat(gift.cost).toFixed(0) : 0}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Click a gift to edit recipients or givers.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Save Button - for saving person selection changes */}
            {!arrangement?.id && (
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Create Arrangement"}
                </Button>
              </div>
            )}
          </>
        )}

        {selectedPersonIds.length < 2 && (
          <div className="text-center py-12 text-slate-500">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select at least 2 people to start matching gifts</p>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeItem && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 border border-violet-400 shadow-lg text-white">
            <GripVertical className="h-4 w-4 opacity-50" />
            <span className="font-medium">{activeItem.name}</span>
            {typeof activeItem.cost === "number" && (
              <span className="text-violet-200">${activeItem.cost.toFixed(0)}</span>
            )}
          </div>
        )}
      </DragOverlay>

      <GroupManageModal
        open={!!manageGroupItem}
        onOpenChange={(open) => !open && setManageGroupItem(null)}
        item={manageGroupItem}
        gifts={gifts}
        onRemoveGiftFromGroup={handleRemoveGiftFromGroup}
      />

      <SharedGiftEditDialog
        gift={editingSharedGift}
        people={people}
        open={!!editingSharedGift}
        onOpenChange={(open) => !open && setEditingSharedGift(null)}
        onGiftUpdated={handleSharedGiftUpdated}
        onPersonCreated={handlePersonCreated}
      />

      <AddGiftForPersonDialog
        person={addGiftForPerson}
        people={people}
        onPersonCreated={handlePersonCreated}
        holidayId={holidayId}
        statuses={statuses}
        open={!!addGiftForPerson}
        onOpenChange={(open) => !open && setAddGiftForPerson(null)}
        onGiftCreated={handleGiftCreated}
      />
    </DndContext>
  );
}

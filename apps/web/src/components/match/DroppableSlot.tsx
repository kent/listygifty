"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { X, GripVertical, Layers } from "lucide-react";
import type { MatchDisplayItem } from "./MatchWorkspace";

interface DroppableSlotProps {
  id: string;
  item: MatchDisplayItem | null | undefined;
  rowIndex: number;
  onRemove: () => void;
  onManageGroup?: (item: MatchDisplayItem) => void;
}

function DraggableSlotItem({
  item,
  onManageGroup,
  onRemove,
}: {
  item: MatchDisplayItem;
  onManageGroup?: (item: MatchDisplayItem) => void;
  onRemove: () => void;
}) {
  const combineId = `combine-${item.personId}-${item.id}`;
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: combineId });
  const { attributes, listeners, setNodeRef: setDragRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: item.id,
  });

  const isGroup = item.kind === "group";
  const giftCount = item.giftIds.length;

  const handleClick = (e: React.MouseEvent) => {
    if (isGroup && onManageGroup) {
      e.stopPropagation();
      onManageGroup(item);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const setRefs = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setRefs}
      {...listeners}
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-2 rounded transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      } ${isOver ? "bg-violet-50 ring-2 ring-violet-600 dark:bg-violet-600/40 dark:ring-violet-400" : ""} ${
        isGroup ? "hover:bg-accent" : ""
      }`}
    >
      {/* The whole row drags by pointer. Only the handle takes keyboard focus, so the
          remove button isn't nested in another control and keeps its keys. */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        type="button"
        aria-label={`Move ${item.name}`}
        className="flex-shrink-0 rounded-sm text-muted-foreground cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {isGroup && <Layers className="h-4 w-4 text-fuchsia-700 dark:text-fuchsia-400 flex-shrink-0" />}
      <span className="text-foreground font-medium truncate flex-1 min-w-0">{item.name}</span>
      {isGroup && (
        <span className="text-xs bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300 px-2 py-0.5 rounded-full flex-shrink-0">
          {giftCount}
        </span>
      )}
      {Number.isFinite(item.cost) && (
        <span className="text-muted-foreground text-sm flex-shrink-0">
          ${Number(item.cost).toFixed(0)}
        </span>
      )}
      <button
        onClick={handleRemove}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Remove ${item.name} from slot`}
        className="text-muted-foreground hover:text-red-700 dark:hover:text-red-400 transition-colors flex-shrink-0 ml-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DroppableSlot({ id, item, rowIndex, onRemove, onManageGroup }: DroppableSlotProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[44px] rounded-lg border-2 border-dashed transition-all ${
        isOver
          ? "border-violet-500 bg-violet-50 dark:bg-violet-500/20"
          : item
          ? "border-input bg-muted/50"
          : "border-border/50 bg-muted/30"
      }`}
    >
      {item ? (
        <DraggableSlotItem item={item} onManageGroup={onManageGroup} onRemove={onRemove} />
      ) : (
        <div className="flex items-center justify-center h-[40px] text-muted-foreground text-sm">
          Row {rowIndex + 1}
        </div>
      )}
    </div>
  );
}

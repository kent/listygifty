"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, Layers, Pencil, X } from "lucide-react";
import type { MatchDisplayItem } from "./MatchWorkspace";

interface DraggableGiftProps {
  item: MatchDisplayItem;
  combineTargetId: string;
  onRenameGroup?: (id: string) => void;
  onRemoveGroup?: (id: string) => void;
  onEdit?: () => void;
}

export function DraggableGift({
  item,
  combineTargetId,
  onRenameGroup,
  onRemoveGroup,
  onEdit,
}: DraggableGiftProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  // Disable droppable when this item is being dragged (can't combine with itself)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: combineTargetId,
    disabled: isDragging,
  });

  const setRefs = (el: HTMLElement | null) => {
    setNodeRef(el);
    setDropRef(el);
  };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const isGroup = item.kind === "group";

  return (
    <div
      ref={setRefs}
      style={style}
      {...listeners}
      className={`group/gift flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? "opacity-50 bg-violet-600/50 border-violet-400"
          : isOver
            ? "bg-violet-50 border-violet-600 dark:bg-violet-700/40 dark:border-violet-400/80"
            : "bg-muted/50 border-border hover:border-violet-500/50 hover:bg-muted"
      }`}
    >
      {/* The whole row drags by pointer. Only the handle takes keyboard focus, so the
          row's own buttons aren't nested in another control and keep their keys. */}
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
      <span className="text-foreground font-medium truncate flex-1">{item.name}</span>
      {Number.isFinite(item.cost) && (
        <span className="text-muted-foreground text-sm flex-shrink-0">
          ${Number(item.cost).toFixed(0)}
        </span>
      )}
      {isGroup ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onRenameGroup?.(item.groupId!);
            }}
            aria-label={`Rename group ${item.name}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onRemoveGroup?.(item.groupId!);
            }}
            aria-label={`Remove group ${item.name}`}
            className="text-muted-foreground hover:text-red-700 dark:hover:text-red-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : onEdit && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label={`Edit ${item.name}`}
          className="opacity-0 group-hover/gift:opacity-100 focus:opacity-100 text-muted-foreground hover:text-violet-700 dark:hover:text-violet-400 transition-all"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

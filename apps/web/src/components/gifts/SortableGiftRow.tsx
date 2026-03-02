"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Loader2, MoreVertical, Info, Users, ExternalLink } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TextCell } from "./TextCell";
import { CurrencyCell } from "./CurrencyCell";
import { StatusCell } from "./StatusCell";
import { PeopleCell } from "./PeopleCell";
import { AddressCell } from "./AddressCell";
import type { Gift, Person, GiftStatus, Address } from "@niftygifty/types";
import { cn } from "@/lib/utils";

interface SortableGiftRowProps {
  gift: Gift & { _isNew?: boolean; _isSaving?: boolean };
  people: Person[];
  statuses: GiftStatus[];
  addresses: Address[];
  showAddresses: boolean;
  deletingId: number | null;
  onUpdateGift: (id: number, updates: { name?: string; gift_status_id?: number; cost?: number }) => void;
  onUpdateRecipients: (id: number, recipientIds: number[]) => void;
  onUpdateGivers: (id: number, giverIds: number[]) => void;
  onUpdateRecipientAddress: (giftId: number, recipientId: number, addressId: number | null) => void;
  onInsertGift: (referenceId: number, position: "above" | "below") => void;
  onRequestDelete: (gift: Gift) => void;
  onPersonCreated: (person: Person) => void;
}

export function SortableGiftRow({
  gift,
  people,
  statuses,
  addresses,
  showAddresses,
  deletingId,
  onUpdateGift,
  onUpdateRecipients,
  onUpdateGivers,
  onUpdateRecipientAddress,
  onInsertGift,
  onRequestDelete,
  onPersonCreated,
}: SortableGiftRowProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: gift.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isShared = !gift.is_mine;
  const creatorName = gift.created_by?.safe_name;

  return (
    <>
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "group transition-colors",
        gift._isNew && "bg-violet-500/5",
        gift._isSaving && "opacity-50",
        isDragging && "bg-muted/50 opacity-80 shadow-lg z-50",
        isShared && "border-l-2 border-l-cyan-500/50"
      )}
    >
      <TableCell className="p-1 w-[40px]">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className={cn(
              "flex items-center justify-center h-8 w-8 cursor-grab active:cursor-grabbing",
              "text-muted-foreground/50 hover:text-muted-foreground transition-colors",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
              isDragging && "opacity-100 cursor-grabbing"
            )}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {isShared && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Users className="h-3 w-3 text-cyan-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Added by {creatorName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className="p-1">
        <PeopleCell
          selectedIds={gift.recipients.map((r) => r.id)}
          people={people}
          onChange={(ids) => onUpdateRecipients(gift.id, ids)}
          onPersonCreated={onPersonCreated}
          placeholder="Select recipient..."
        />
      </TableCell>
      {showAddresses && (
        <TableCell className="p-1">
          <AddressCell
            giftRecipients={gift.gift_recipients || []}
            addresses={addresses}
            onUpdateAddress={(recipientId, addressId) =>
              onUpdateRecipientAddress(gift.id, recipientId, addressId)
            }
          />
        </TableCell>
      )}
      <TableCell className="p-1">
        <PeopleCell
          selectedIds={gift.givers.map((g) => g.id)}
          people={people}
          onChange={(ids) => onUpdateGivers(gift.id, ids)}
          onPersonCreated={onPersonCreated}
          placeholder="Select giver..."
        />
      </TableCell>
      <TableCell className="p-1">
        <TextCell
          value={gift.name}
          onChange={(name) => onUpdateGift(gift.id, { name })}
          placeholder="Gift name..."
          isLink={!!gift.link}
        />
      </TableCell>
      <TableCell className="p-1">
        <StatusCell
          value={gift.gift_status_id}
          statuses={statuses}
          onChange={(statusId) => onUpdateGift(gift.id, { gift_status_id: statusId })}
        />
      </TableCell>
      <TableCell className="p-1">
        <CurrencyCell
          value={gift.cost}
          onChange={(cost) => onUpdateGift(gift.id, { cost: cost ? Number(cost) : undefined })}
        />
      </TableCell>
      <TableCell className="p-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setInfoOpen(true)}>
              <Info className="h-4 w-4 mr-2" />
              Info
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onInsertGift(gift.id, "above")}>
              <Plus className="h-4 w-4 mr-2" />
              Insert above
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertGift(gift.id, "below")}>
              <Plus className="h-4 w-4 mr-2" />
              Insert below
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRequestDelete(gift)}
              disabled={deletingId === gift.id}
              className="text-destructive focus:text-destructive"
            >
              {deletingId === gift.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>

    <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{gift.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {gift.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm">{gift.description}</p>
            </div>
          )}
          
          {gift.link && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Link</p>
              <a
                href={gift.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                {gift.link}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {gift.cost && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cost</p>
              <p className="text-sm">${parseFloat(gift.cost).toFixed(2)}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <p className="text-sm">{gift.gift_status.name}</p>
          </div>

          {gift.recipients.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recipients</p>
              <p className="text-sm">{gift.recipients.map(r => r.name).join(", ")}</p>
            </div>
          )}

          {gift.givers.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Givers</p>
              <p className="text-sm">{gift.givers.map(g => g.name).join(", ")}</p>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">Added by</p>
            <p className="text-sm flex items-center gap-2">
              {creatorName || "Unknown"}
              {isShared && <Users className="h-3 w-3 text-cyan-400" />}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Created</p>
            <p className="text-sm">
              {new Date(gift.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

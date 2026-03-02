"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Users, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextCell } from "./TextCell";
import { StatusCell } from "./StatusCell";
import { PeopleCell } from "./PeopleCell";
import { CurrencyCell } from "./CurrencyCell";
import { cn } from "@/lib/utils";
import type { Gift, Person, GiftStatus } from "@niftygifty/types";

interface MobileGiftCardProps {
  gift: Gift & { _isNew?: boolean; _isSaving?: boolean };
  people: Person[];
  statuses: GiftStatus[];
  isDeleting: boolean;
  onUpdateGift: (id: number, updates: { name?: string; gift_status_id?: number; cost?: number }) => void;
  onUpdateRecipients: (id: number, recipientIds: number[]) => void;
  onUpdateGivers: (id: number, giverIds: number[]) => void;
  onRequestDelete: (gift: Gift) => void;
  onPersonCreated: (person: Person) => void;
}

export function MobileGiftCard({
  gift,
  people,
  statuses,
  isDeleting,
  onUpdateGift,
  onUpdateRecipients,
  onUpdateGivers,
  onRequestDelete,
  onPersonCreated,
}: MobileGiftCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isShared = !gift.is_mine;
  const recipientNames = gift.recipients.map((r) => r.name).join(", ") || "No recipient";

  return (
    <Card
      className={cn(
        "border-slate-800 bg-slate-900/50 backdrop-blur-sm transition-all",
        gift._isNew && "ring-1 ring-violet-500/50",
        gift._isSaving && "opacity-50",
        isShared && "border-l-2 border-l-cyan-500/50"
      )}
    >
      <CardContent className="p-0">
        {/* Main row - always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 flex items-start gap-3 text-left"
        >
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate text-base">
                {gift.name || "Untitled gift"}
              </span>
              {gift.link && (
                <ExternalLink className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              )}
              {isShared && (
                <Users className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="truncate">For: {recipientNames}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: gift.gift_status.color || undefined,
                color: gift.gift_status.color || undefined,
              }}
            >
              {gift.gift_status.name}
            </Badge>
            {gift.cost && (
              <span className="text-sm font-medium text-slate-300">
                ${parseFloat(gift.cost).toFixed(0)}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </div>
        </button>

        {/* Expanded edit section */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-800 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Name</label>
              <TextCell
                value={gift.name}
                onChange={(name) => onUpdateGift(gift.id, { name })}
                placeholder="Gift name..."
                isLink={!!gift.link}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">To</label>
                <PeopleCell
                  selectedIds={gift.recipients.map((r) => r.id)}
                  people={people}
                  onChange={(ids) => onUpdateRecipients(gift.id, ids)}
                  onPersonCreated={onPersonCreated}
                  placeholder="Recipient..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">From</label>
                <PeopleCell
                  selectedIds={gift.givers.map((g) => g.id)}
                  people={people}
                  onChange={(ids) => onUpdateGivers(gift.id, ids)}
                  onPersonCreated={onPersonCreated}
                  placeholder="Giver..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Status</label>
                <StatusCell
                  value={gift.gift_status_id}
                  statuses={statuses}
                  onChange={(statusId) => onUpdateGift(gift.id, { gift_status_id: statusId })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Cost</label>
                <CurrencyCell
                  value={gift.cost}
                  onChange={(cost) => onUpdateGift(gift.id, { cost: cost ? Number(cost) : undefined })}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRequestDelete(gift)}
                disabled={isDeleting}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

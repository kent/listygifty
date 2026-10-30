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
import { captureWebEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { getMerchantLabel, normalizeExternalUrl } from "@/lib/url";
import type { Gift, Person, GiftStatus } from "@niftygifty/types";

interface MobileGiftCardProps {
  gift: Gift & { _isNew?: boolean; _isSaving?: boolean };
  people: Person[];
  statuses: GiftStatus[];
  isDeleting: boolean;
  onUpdateGift: (
    id: number,
    updates: { name?: string; gift_status_id?: number; cost?: number },
    options?: { source?: string }
  ) => void;
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
  const giftLabel = gift.name || "untitled gift";
  const fieldId = `gift-${gift.id}`;
  const recipientNames = gift.recipients.map((r) => r.name).join(", ") || "No recipient";
  const merchantLabel = getMerchantLabel(gift.link);
  const linkHref = normalizeExternalUrl(gift.link);

  return (
    <Card
      className={cn(
        "border-border/50 bg-card/50 backdrop-blur-sm transition-all",
        gift._isNew && "ring-1 ring-violet-500/50",
        gift._isSaving && "opacity-50",
        isShared && "border-l-2 border-l-cyan-500/50"
      )}
    >
      <CardContent className="p-0">
        {/* Main row - always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="w-full p-4 flex items-start gap-3 text-left"
        >
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate text-base">
                {gift.name || "Untitled gift"}
              </span>
              {gift.link && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-300">
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {merchantLabel || "Link"}
                </span>
              )}
              {isShared && (
                <Users className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              <span className="text-sm font-medium text-muted-foreground">
                ${parseFloat(gift.cost).toFixed(0)}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded edit section */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
            <div className="space-y-2">
              <label htmlFor={`${fieldId}-name`} className="text-xs font-medium text-muted-foreground">Name</label>
              <TextCell
                id={`${fieldId}-name`}
                value={gift.name}
                onChange={(name) => onUpdateGift(gift.id, { name })}
                placeholder="Gift name..."
                aria-label="Edit gift name"
                isLink={!!gift.link}
                linkHref={linkHref}
                linkLabel={merchantLabel || "Open link"}
                onLinkClick={() =>
                  captureWebEvent("gift_link_opened", {
                    gift_id: gift.id,
                    holiday_id: gift.holiday_id,
                    merchant: merchantLabel,
                    source: "mobile_gift_card",
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor={`${fieldId}-to`} className="text-xs font-medium text-muted-foreground">To</label>
                <PeopleCell
                  id={`${fieldId}-to`}
                  selectedIds={gift.recipients.map((r) => r.id)}
                  people={people}
                  onChange={(ids) => onUpdateRecipients(gift.id, ids)}
                  onPersonCreated={onPersonCreated}
                  placeholder="Recipient..."
                  aria-label={`To: recipients of ${giftLabel}`}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`${fieldId}-from`} className="text-xs font-medium text-muted-foreground">From</label>
                <PeopleCell
                  id={`${fieldId}-from`}
                  selectedIds={gift.givers.map((g) => g.id)}
                  people={people}
                  onChange={(ids) => onUpdateGivers(gift.id, ids)}
                  onPersonCreated={onPersonCreated}
                  placeholder="Giver..."
                  aria-label={`From: givers of ${giftLabel}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor={`${fieldId}-status`} className="text-xs font-medium text-muted-foreground">Status</label>
                <StatusCell
                  id={`${fieldId}-status`}
                  value={gift.gift_status_id}
                  statuses={statuses}
                  onChange={(statusId) =>
                    onUpdateGift(gift.id, { gift_status_id: statusId }, { source: "mobile_gift_card" })
                  }
                  aria-label={`Status of ${giftLabel}`}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`${fieldId}-cost`} className="text-xs font-medium text-muted-foreground">Cost</label>
                <CurrencyCell
                  id={`${fieldId}-cost`}
                  value={gift.cost}
                  onChange={(cost) => onUpdateGift(gift.id, { cost: cost ? Number(cost) : undefined })}
                  aria-label={`Edit cost of ${giftLabel}`}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRequestDelete(gift)}
                disabled={isDeleting}
                className="text-red-700 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-500/10"
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

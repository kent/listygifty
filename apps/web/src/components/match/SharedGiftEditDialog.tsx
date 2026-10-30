"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import { Gift as GiftIcon, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PeopleCell } from "@/components/gifts/PeopleCell";
import { giftsService } from "@/services";
import { toast } from "sonner";
import type { Gift, Person } from "@niftygifty/types";

interface SharedGiftEditDialogProps {
  gift: Gift | null;
  people: Person[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGiftUpdated: (gift: Gift) => void;
  onPersonCreated: (person: Person) => void;
}

// Each save sends the whole list and the API replaces what's there, so the pickers
// must start from the gift's real people. Mounting per gift and per opening does
// that: the parent opens this through props, so there's no open event to sync on.
export function SharedGiftEditDialog({ gift, open, ...props }: SharedGiftEditDialogProps) {
  if (!gift || !open) return null;
  return <OpenSharedGiftEditDialog key={gift.id} gift={gift} {...props} />;
}

function OpenSharedGiftEditDialog({
  gift,
  people,
  onOpenChange,
  onGiftUpdated,
  onPersonCreated,
}: Omit<SharedGiftEditDialogProps, "open"> & { gift: Gift }) {
  const [isPending, startTransition] = useTransition();
  const [localRecipients, setLocalRecipients] = useState(() => gift.recipients.map(r => r.id));
  const [localGivers, setLocalGivers] = useState(() => gift.givers.map(g => g.id));

  // The gift prop stays as it was when the dialog opened, so a failed save falls
  // back to the last list the server accepted. The opening list would forget
  // earlier saves, and the next save would then delete those people.
  const savedRecipients = useRef(localRecipients);
  const savedGivers = useRef(localGivers);

  const updateRecipients = useCallback((ids: number[]) => {
    setLocalRecipients(ids);

    startTransition(async () => {
      try {
        const updated = await giftsService.update(gift.id, { recipient_ids: ids });
        savedRecipients.current = ids;
        onGiftUpdated(updated);
      } catch {
        toast.error("Failed to update recipients");
        setLocalRecipients(savedRecipients.current);
      }
    });
  }, [gift.id, onGiftUpdated]);

  const updateGivers = useCallback((ids: number[]) => {
    setLocalGivers(ids);

    startTransition(async () => {
      try {
        const updated = await giftsService.update(gift.id, { giver_ids: ids });
        savedGivers.current = ids;
        onGiftUpdated(updated);
      } catch {
        toast.error("Failed to update givers");
        setLocalGivers(savedGivers.current);
      }
    });
  }, [gift.id, onGiftUpdated]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GiftIcon className="h-5 w-5 text-violet-700 dark:text-violet-400" />
            Edit Gift
            {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gift Name & Link */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="font-medium text-foreground">{gift.name}</p>
            {gift.link && (
              <a
                href={gift.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-700 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 flex items-center gap-1 mt-1"
              >
                View link <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {gift.description && (
              <p className="text-sm text-muted-foreground mt-2">{gift.description}</p>
            )}
          </div>

          {/* Cost & Status are read-only here, so they're captions rather than labels */}
          <dl className="flex gap-4">
            <div className="flex-1">
              <dt className="text-sm text-muted-foreground">Cost</dt>
              <dd className="font-medium text-foreground">
                {gift.cost ? `$${parseFloat(gift.cost).toFixed(0)}` : "Not set"}
              </dd>
            </div>
            <div className="flex-1">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium text-foreground">{gift.gift_status.name}</dd>
            </div>
          </dl>

          {/* Recipients (To) */}
          <div>
            <Label htmlFor="shared-gift-recipients" className="text-sm text-muted-foreground mb-2 block">To (Recipients)</Label>
            <PeopleCell
              id="shared-gift-recipients"
              selectedIds={localRecipients}
              people={people}
              onChange={updateRecipients}
              onPersonCreated={onPersonCreated}
              placeholder="Select recipients..."
              className="bg-muted/50 border border-border hover:bg-muted"
            />
          </div>

          {/* Givers (From) */}
          <div>
            <Label htmlFor="shared-gift-givers" className="text-sm text-muted-foreground mb-2 block">From (Givers)</Label>
            <PeopleCell
              id="shared-gift-givers"
              selectedIds={localGivers}
              people={people}
              onChange={updateGivers}
              onPersonCreated={onPersonCreated}
              placeholder="Select givers..."
              className="bg-muted/50 border border-border hover:bg-muted"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

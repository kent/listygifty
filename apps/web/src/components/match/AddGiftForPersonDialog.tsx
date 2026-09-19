"use client";

import type { Gift, Person, GiftStatus } from "@niftygifty/types";
import { NewGiftDialog } from "@/components/gifts/NewGiftDialog";

interface AddGiftForPersonDialogProps {
  person: Person | null;
  people: Person[];
  holidayId: number;
  statuses: GiftStatus[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGiftCreated: (gift: Gift) => void;
  onPersonCreated: (person: Person) => void;
}

export function AddGiftForPersonDialog({ person, ...props }: AddGiftForPersonDialogProps) {
  if (!person) return null;
  return <NewGiftDialog key={person.id} {...props} initialRecipientIds={[person.id]} />;
}

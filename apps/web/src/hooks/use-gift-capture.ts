"use client";

import { useRef, useState } from "react";
import type { Gift, GiftStatus } from "@niftygifty/types";
import { giftsService } from "@/services";
import { ApiError } from "@/lib/api-client";
import { normalizeExternalUrl } from "@/lib/url";
import { toast } from "sonner";

export interface GiftCaptureOptions {
  onOpenChange: (open: boolean) => void;
  holidayId: number;
  statuses: GiftStatus[];
  defaultStatusId?: number;
  initialRecipientIds?: number[];
  position?: number;
  onGiftCreated: (gift: Gift) => void;
}

export function useGiftCapture({
  onOpenChange, holidayId, statuses, defaultStatusId,
  initialRecipientIds = [], position, onGiftCreated,
}: GiftCaptureOptions) {
  const [step, setStep] = useState<"name" | "details">("name");
  const [name, setName] = useState("");
  const [recipientIds, setRecipientIds] = useState(initialRecipientIds);
  const [giverIds, setGiverIds] = useState<number[]>([]);
  const [statusId, setStatusId] = useState(defaultStatusId ?? statuses[0]?.id);
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [cost, setCost] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savingMode, setSavingMode] = useState<"done" | "another" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const saving = savingMode !== null;
  const resolvedStatusId = statuses.find((status) => status.id === statusId)?.id ?? statuses[0]?.id;
  const canSave = Boolean(name.trim() && holidayId && resolvedStatusId) && !saving;

  async function save(mode: "done" | "another") {
    if (!canSave || submittingRef.current) return;
    const parsedCost = cost.trim() ? Number(cost) : undefined;
    if (parsedCost !== undefined && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      setError("Enter a valid cost of zero or more.");
      setAdvancedOpen(true);
      return;
    }
    submittingRef.current = true;
    setSavingMode(mode);
    setError(null);
    let created: Gift;
    try {
      created = await giftsService.create({
        name: name.trim(), holiday_id: holidayId, gift_status_id: resolvedStatusId!,
        recipient_ids: recipientIds, giver_ids: giverIds, position,
        description: description.trim() || undefined,
        link: normalizeExternalUrl(link) || undefined, cost: parsedCost,
      });
    } catch (err) {
      if (err instanceof ApiError && err.isGiftLimitReached) {
        setError("Gift limit reached. Upgrade to Premium to add more gifts.");
      } else {
        setError("Couldn't add your gift. Your details are still here. Try again.");
      }
      submittingRef.current = false;
      setSavingMode(null);
      return;
    }
    // Creation is complete. Refresh errors must never turn a saved gift into a retry.
    onGiftCreated(created);
    toast.success("Gift added");
    if (mode === "another") {
      setName("");
      setDescription("");
      setLink("");
      setCost("");
      setAdvancedOpen(false);
      setStep("name");
      submittingRef.current = false;
      setSavingMode(null);
    } else {
      onOpenChange(false);
    }
  }

  return {
    step, setStep, name, setName, recipientIds, setRecipientIds, giverIds, setGiverIds,
    resolvedStatusId, setStatusId, description, setDescription, link, setLink, cost, setCost,
    advancedOpen, setAdvancedOpen, savingMode, saving, error, canSave, save,
    close: (open: boolean) => { if (!submittingRef.current) onOpenChange(open); },
  };
}

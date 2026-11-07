"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ExchangeParticipant } from "@niftygifty/types";
import { exchangeParticipantsService } from "@/services";
import { humanizeError } from "@/lib/error-message";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INPUT_CLASS = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white";

interface NudgeParticipantDialogProps {
  exchangeId: number;
  // The person to nudge. The dialog is open while this is set.
  participant: ExchangeParticipant | null;
  onClose: () => void;
  onNudged: (participant: ExchangeParticipant) => void;
}

// Reminds someone who hasn't answered their invite. It always emails, and
// texts too when there's a mobile number. The organizer can fix the email or
// add a number here, and the API keeps both for next time.
export function NudgeParticipantDialog({ exchangeId, participant, onClose, onNudged }: NudgeParticipantDialogProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!participant) return;
    setEmail(participant.email ?? "");
    setPhone(formatPhone(participant.phone));
  }, [participant]);

  const name = participant?.display_name ?? "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!participant || !email.trim()) return;

    setSending(true);
    try {
      const result = await exchangeParticipantsService.nudge(exchangeId, participant.id, {
        email: email.trim(),
        phone: phone.trim(),
      });
      onNudged(result.participant);
      if (result.text === "sent") {
        toast.success(`Nudged ${name} by email and text`);
      } else if (result.text === "failed") {
        toast.warning(`Emailed ${name}, but the text didn't go through. ${result.text_error ?? ""}`.trim());
      } else {
        toast.success(`Nudged ${name} by email`);
      }
      onClose();
    } catch (err: unknown) {
      toast.error(humanizeError(err, "Couldn't send the nudge. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={participant !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Nudge {name}</DialogTitle>
          <DialogDescription>
            We&apos;ll send {name} their invite link again. Add their mobile number to text it too.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nudge-email" className="text-slate-700 dark:text-slate-300">Email</Label>
            <Input
              id="nudge-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASS}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nudge-phone" className="text-slate-700 dark:text-slate-300">
              Mobile number <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
            </Label>
            <Input
              id="nudge-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(416) 555-0123"
              className={INPUT_CLASS}
            />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              The text comes from Listy Gifty. They can reply STOP to opt out.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send nudge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

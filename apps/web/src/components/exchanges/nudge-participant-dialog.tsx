"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NUDGE_TEXT_FROM_NUMBER, type ExchangeParticipant } from "@niftygifty/types";
import { exchangeParticipantsService } from "@/services";
import { humanizeError } from "@/lib/error-message";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
// texts too when there's a mobile number and the organizer confirms the
// person said it's OK to text them. Carriers require that consent, and
// /sms shows them this form as the proof. The organizer can fix the email
// or add a number here, and the API keeps both for next time.
export function NudgeParticipantDialog({ exchangeId, participant, onClose, onNudged }: NudgeParticipantDialogProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [textConsent, setTextConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!participant) return;
    setEmail(participant.email ?? "");
    setPhone(formatPhone(participant.phone));
    setTextConsent(Boolean(participant.phone && participant.text_consent_at));
    setConsentMissing(false);
  }, [participant]);

  const name = participant?.display_name ?? "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!participant || !email.trim()) return;
    const hasPhone = phone.trim() !== "";
    if (hasPhone && !textConsent) {
      setConsentMissing(true);
      return;
    }

    setSending(true);
    try {
      const result = await exchangeParticipantsService.nudge(exchangeId, participant.id, {
        email: email.trim(),
        phone: phone.trim(),
        text_consent: hasPhone && textConsent,
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
              The text comes from Listy Gifty at {NUDGE_TEXT_FROM_NUMBER}. They can reply STOP to opt out.{" "}
              <a href="/sms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                How texts work
              </a>
            </p>
          </div>
          {phone.trim() !== "" && (
            <div className="space-y-1">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="nudge-text-consent"
                  checked={textConsent}
                  onCheckedChange={(checked) => {
                    setTextConsent(checked === true);
                    setConsentMissing(false);
                  }}
                  aria-invalid={consentMissing}
                  aria-describedby={consentMissing ? "nudge-text-consent-error" : undefined}
                  className="mt-0.5"
                />
                <Label htmlFor="nudge-text-consent" className="font-normal leading-snug text-slate-700 dark:text-slate-300">
                  {name} said it&apos;s OK to text them about this exchange.
                </Label>
              </div>
              {consentMissing && (
                <p id="nudge-text-consent-error" className="text-xs text-red-600 dark:text-red-400">
                  Check this box to text them, or clear the number to just email them.
                </p>
              )}
            </div>
          )}
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

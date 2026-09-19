"use client";

import { useRef } from "react";
import { ArrowRight, ChevronDown, Gift as GiftIcon, Loader2 } from "lucide-react";
import type { Person } from "@niftygifty/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PeopleCell } from "./PeopleCell";

import { useGiftCapture, type GiftCaptureOptions } from "@/hooks/use-gift-capture";

interface NewGiftDialogProps extends GiftCaptureOptions {
  open: boolean;
  people: Person[];
  onPersonCreated: (person: Person) => void;
}

// Unmount the draft on close so every entry point starts with a clean form.
export function NewGiftDialog(props: NewGiftDialogProps) {
  return props.open ? <GiftCaptureDialog {...props} /> : null;
}

function GiftCaptureDialog(props: NewGiftDialogProps) {
  const { people, statuses, onPersonCreated, onOpenChange } = props;
  const {
    step, setStep, name, setName, recipientIds, setRecipientIds, giverIds, setGiverIds,
    resolvedStatusId, setStatusId, description, setDescription, link, setLink, cost, setCost,
    advancedOpen, setAdvancedOpen, savingMode, saving, error, canSave, save, close,
  } = useGiftCapture(props);
  const detailsTitleRef = useRef<HTMLHeadingElement>(null);

  function next() {
    if (!name.trim()) return;
    setStep("details");
    // Move keyboard and screen reader focus to the newly displayed screen.
    requestAnimationFrame(() => detailsTitleRef.current?.focus());
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="flex w-[calc(100%_-_2rem)] max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader className="px-6 pt-6 pb-5 text-left">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
            <GiftIcon className="size-4" />
            {step === "name" ? "1 of 2 · The gift" : "2 of 2 · The details"}
          </p>
          <DialogTitle ref={detailsTitleRef} tabIndex={-1} className="break-words text-2xl leading-tight outline-none">
            {step === "name" ? "What's the gift?" : name.trim()}
          </DialogTitle>
          <DialogDescription>
            {step === "name" ? "Start with a name. Details come next." : "Pick who it's for, or save the idea for later."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-col" onSubmit={(event) => {
          event.preventDefault();
          if (step === "name") next(); else void save("done");
        }}>
          <div className="overflow-y-auto px-6 pb-6">
            {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            {step === "name" ? (
              <div className="space-y-2">
                <Label htmlFor="new-gift-name" className="sr-only">Gift name</Label>
                <Input id="new-gift-name" value={name} onChange={(event) => setName(event.target.value)}
                  placeholder="e.g., Nintendo Switch" autoFocus autoComplete="off" enterKeyHint="next"
                  className="h-14 text-base md:text-lg" />
              </div>
            ) : (
              <fieldset disabled={saving} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-gift-recipients">Who is it for?</Label>
                  <PeopleCell id="new-gift-recipients" selectedIds={recipientIds} people={people} onChange={setRecipientIds}
                    onPersonCreated={onPersonCreated} placeholder="Choose people (optional)" className="min-h-11 border px-3" />
                </div>
                <div className="space-y-2">
                  <span id="new-gift-status-label" className="text-sm font-medium">Status</span>
                  <div role="group" aria-labelledby="new-gift-status-label" className="flex flex-wrap gap-2">
                    {statuses.map((status) => (
                      <Button key={status.id} type="button" variant={resolvedStatusId === status.id ? "default" : "outline"}
                        aria-pressed={resolvedStatusId === status.id} onClick={() => setStatusId(status.id)} className="min-h-11">
                        {status.name}
                      </Button>
                    ))}
                  </div>
                  {!resolvedStatusId && <p role="alert" className="text-sm text-destructive">No gift statuses available. Reopen this form after refreshing the list.</p>}
                </div>
                <div className="border-t pt-1">
                  <button type="button" aria-expanded={advancedOpen} aria-controls="new-gift-advanced"
                    onClick={() => setAdvancedOpen(!advancedOpen)} className="flex w-full items-center justify-between py-4 text-left">
                    <span><span className="block text-sm font-semibold">Advanced</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Notes, link, cost, and givers</span></span>
                    <ChevronDown className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div id="new-gift-advanced" hidden={!advancedOpen} className="space-y-4 pt-1">
                    <div className="space-y-2">
                      <Label htmlFor="new-gift-description">Notes</Label>
                      <Textarea id="new-gift-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Size, colour, or a reminder" rows={2} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-gift-link">Link</Label>
                      <Input id="new-gift-link" inputMode="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-gift-cost">Cost</Label>
                      <Input id="new-gift-cost" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-gift-givers">From (Givers)</Label>
                      <PeopleCell id="new-gift-givers" selectedIds={giverIds} people={people} onChange={setGiverIds}
                        onPersonCreated={onPersonCreated} placeholder="Who is giving this gift?" className="min-h-11 border px-3" />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}
          </div>
          <div className="grid gap-2 border-t bg-background px-6 py-4">
            <Button type="submit" disabled={step === "name" ? !name.trim() : !canSave} className="h-11">
              {savingMode === "done" ? <><Loader2 className="size-4 animate-spin" />Adding...</> : step === "name" ? <>Next<ArrowRight className="size-4" /></> : "Add Gift"}
            </Button>
            {step === "details" && (
              <Button type="button" variant="outline" disabled={!canSave} onClick={() => void save("another")} className="h-11">
                {savingMode === "another" ? <><Loader2 className="size-4 animate-spin" />Adding...</> : "Save & Add Another"}
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={saving} onClick={() => step === "name" ? onOpenChange(false) : setStep("name")}>
              {step === "name" ? "Cancel" : "Back"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { RELATIONSHIP_CATEGORIES } from "@niftygifty/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";

interface NewPersonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, relationship?: string) => Promise<void>;
}

export function NewPersonModal({ open, onOpenChange, onSubmit }: NewPersonModalProps) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), relationship || undefined);
      setName("");
      setRelationship("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setRelationship("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
              <UserPlus className="h-5 w-5 text-fuchsia-500 dark:text-fuchsia-400" />
            </div>
            <div>
              <DialogTitle className="text-slate-900 dark:text-white">Add New Person</DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400">
                Add someone to your gift list
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter person's name"
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-500"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="relationship" className="text-slate-700 dark:text-slate-300">
              Category
            </Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                {RELATIONSHIP_CATEGORIES.map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white capitalize"
                  >
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem
                  value="other"
                  className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white"
                >
                  Other
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500"
            >
              {isSubmitting ? "Adding..." : "Add Person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


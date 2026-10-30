"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CurrencyCellProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  id?: string;
  /** Required: with no amount the button has no text to name it. Names the
      input too, and is followed by the amount on the edit button. */
  "aria-label": string;
}

export function CurrencyCell({ value, onChange, className, id, "aria-label": ariaLabel }: CurrencyCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  const startEditing = useCallback(() => {
    setEditValue(value || "");
    setEditing(true);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    } else if (!editing && restoreFocusRef.current) {
      // Enter and Escape remove the focused input. Tabbing away keeps its own target.
      restoreFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  const formatCurrency = (val: string | null): string => {
    if (!val) return "";
    const num = parseFloat(val);
    if (isNaN(num)) return "";
    return `$${num.toFixed(2)}`;
  };

  const commit = useCallback(() => {
    setEditing(false);
    const cleaned = editValue.replace(/[^0-9.]/g, "");
    const newValue = cleaned ? cleaned : null;
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      restoreFocusRef.current = true;
      commit();
    } else if (e.key === "Escape") {
      restoreFocusRef.current = true;
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          $
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          aria-label={ariaLabel}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full bg-transparent border-none outline-none pl-5 pr-2 py-1 text-sm text-right",
            "focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 rounded",
            className
          )}
          placeholder="0.00"
        />
      </div>
    );
  }

  const formatted = formatCurrency(value);

  return (
    <button
      ref={editButtonRef}
      id={id}
      type="button"
      aria-label={formatted ? `${ariaLabel}: ${formatted}` : ariaLabel}
      onClick={startEditing}
      className={cn(
        "block w-full px-2 py-1 cursor-pointer min-h-[28px] hover:bg-muted/50 rounded text-sm text-right",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !value && "text-muted-foreground",
        className
      )}
    >
      {formatted}
    </button>
  );
}


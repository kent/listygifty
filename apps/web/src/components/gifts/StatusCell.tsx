"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { GiftStatus } from "@niftygifty/types";
import { cn } from "@/lib/utils";

interface StatusCellProps {
  value: number;
  statuses: GiftStatus[];
  onChange: (statusId: number) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function StatusCell({
  value,
  statuses,
  onChange,
  className,
  id,
  "aria-label": ariaLabel,
}: StatusCellProps) {
  const currentStatus = statuses.find((s) => s.id === value);

  return (
    <Select
      value={value.toString()}
      onValueChange={(val) => onChange(parseInt(val, 10))}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "border-none shadow-none h-auto py-1 px-2 hover:bg-muted/50 focus:ring-0",
          className
        )}
      >
        <SelectValue>
          {currentStatus ? (
            <Badge variant="secondary" className="font-normal">
              {currentStatus.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">Select status</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem key={status.id} value={status.id.toString()}>
            <Badge variant="secondary" className="font-normal">
              {status.name}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


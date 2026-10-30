"use client";

import { useState } from "react";
import { MapPin, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Address, GiftRecipientWithAddress } from "@niftygifty/types";

interface AddressCellProps {
  giftRecipients: GiftRecipientWithAddress[];
  addresses: Address[];
  onUpdateAddress: (recipientId: number, addressId: number | null) => void;
  className?: string;
}

export function AddressCell({
  giftRecipients,
  addresses,
  onUpdateAddress,
  className,
}: AddressCellProps) {
  const [open, setOpen] = useState(false);

  // Count recipients with addresses set
  const addressedCount = giftRecipients.filter((r) => r.shipping_address_id).length;
  const totalCount = giftRecipients.length;
  const allAddressed = totalCount > 0 && addressedCount === totalCount;

  if (totalCount === 0) {
    return (
      <div className={cn("px-2 py-1", className)}>
        <span className="text-muted-foreground text-sm">-</span>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("px-2 py-1 flex items-center gap-1 text-muted-foreground", className)}>
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-sm">No addresses</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add addresses in Settings to assign shipping addresses</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Shipping addresses: ${addressedCount} of ${totalCount} set`}
          className={cn(
            "h-auto py-1 px-2 hover:bg-muted/50 font-normal gap-1.5",
            !allAddressed && "text-muted-foreground",
            className
          )}
        >
          <MapPin className={cn("h-3.5 w-3.5", allAddressed && "text-green-500")} />
          <span className="text-sm">
            {addressedCount}/{totalCount}
          </span>
          {allAddressed && <Check className="h-3 w-3 text-green-500" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            Shipping Addresses
          </div>
          <div className="space-y-2">
            {giftRecipients.map((recipient) => (
              <div key={recipient.id} className="space-y-1">
                <div className="text-sm font-medium">{recipient.person.name}</div>
                <Select
                  value={recipient.shipping_address_id?.toString() || "none"}
                  onValueChange={(val) => {
                    const addressId = val === "none" ? null : parseInt(val, 10);
                    onUpdateAddress(recipient.id, addressId);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm" aria-label={`Shipping address for ${recipient.person.name}`}>
                    <SelectValue placeholder="Select address..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <X className="h-3 w-3" />
                        No address
                      </span>
                    </SelectItem>
                    {addresses.map((address) => (
                      <SelectItem key={address.id} value={address.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{address.label}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {address.formatted_address_single_line}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
